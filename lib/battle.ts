import { randomInt } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { pickWeighted } from "./rng";
import { itemPrice } from "./pricing";
import { round2 } from "./format";

export const BATTLE_MAX_CASES = 10;
export const BATTLE_SIZES = [2, 3, 4];

type Tx = Prisma.TransactionClient;

export class BattleError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export function parseCaseIds(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// Комната заполнилась: каждый игрок открывает каждый кейс, победитель забирает все скины.
export async function resolveBattle(tx: Tx, battleId: string) {
  const battle = await tx.battle.findUniqueOrThrow({
    where: { id: battleId },
    include: { players: { orderBy: { slot: "asc" } } },
  });
  const caseIds = parseCaseIds(battle.caseIds);
  const cases = await tx.case.findMany({
    where: { id: { in: [...new Set(caseIds)] } },
    include: { items: { where: { dropChance: { gt: 0 } }, include: { item: { include: { catalog: true } } } } },
  });
  const byId = new Map(cases.map((c) => [c.id, c]));

  const totals = new Map(battle.players.map((p) => [p.userId, 0]));
  const drops: { userId: string; round: number; itemId: string; price: number; caseId: string; casePrice: number }[] = [];
  caseIds.forEach((cid, round) => {
    const kase = byId.get(cid);
    if (!kase || kase.items.length === 0) return; // кейс удалили — раунд пропускается
    for (const p of battle.players) {
      const win = pickWeighted(kase.items);
      const price = round2(itemPrice(win.item));
      drops.push({ userId: p.userId, round, itemId: win.itemId, price, caseId: kase.id, casePrice: kase.price });
      totals.set(p.userId, round2((totals.get(p.userId) ?? 0) + price));
    }
  });

  // победитель — у кого сумма больше; при равенстве решает жребий
  const best = Math.max(...totals.values());
  const leaders = battle.players.filter((p) => totals.get(p.userId) === best);
  const winner = leaders[randomInt(0, leaders.length)];

  if (drops.length) {
    await tx.battleDrop.createMany({
      data: drops.map((d) => ({ battleId, userId: d.userId, round: d.round, itemId: d.itemId, price: d.price })),
    });
    await tx.opening.createMany({
      data: drops.map((d) => ({ userId: d.userId, caseId: d.caseId, itemId: d.itemId, pricePaid: d.casePrice, itemPrice: d.price })),
    });
    await tx.inventoryItem.createMany({
      data: drops.map((d) => ({ userId: winner.userId, itemId: d.itemId, dropPrice: d.price })),
    });
  }
  for (const p of battle.players) {
    await tx.battlePlayer.update({ where: { id: p.id }, data: { total: totals.get(p.userId) ?? 0 } });
  }
  await tx.battle.update({
    where: { id: battleId },
    data: { status: "DONE", winnerId: winner.userId, finishedAt: new Date() },
  });
}

// Всё, что нужно странице комнаты
export async function battleView(id: string) {
  const b = await prisma.battle.findUnique({
    where: { id },
    include: {
      players: { orderBy: { slot: "asc" }, include: { user: { select: { id: true, username: true, avatar: true } } } },
      drops: { orderBy: [{ round: "asc" }], include: { item: true } },
    },
  });
  if (!b) return null;
  const caseIds = parseCaseIds(b.caseIds);
  const cases = await prisma.case.findMany({
    where: { id: { in: [...new Set(caseIds)] } },
    select: {
      id: true,
      name: true,
      image: true,
      price: true,
      slug: true,
      // предметы кейса — только для красоты ленты при показе раунда
      items: { take: 40, select: { dropChance: true, item: { select: { name: true, rarity: true, image: true } } } },
    },
  });
  const byId = new Map(
    cases.map(({ items, ...c }) => [
      c.id,
      { ...c, pool: items.map((ci) => ({ ...ci.item, chance: ci.dropChance })) },
    ]),
  );
  return {
    id: b.id,
    status: b.status,
    maxPlayers: b.maxPlayers,
    cost: b.cost,
    creatorId: b.creatorId,
    winnerId: b.winnerId,
    createdAt: b.createdAt.toISOString(),
    finishedAt: b.finishedAt?.toISOString() ?? null,
    rounds: caseIds.map((cid) => byId.get(cid) ?? { id: cid, name: "Кейс удалён", image: null, price: 0, slug: "", pool: [] }),
    players: b.players.map((p) => ({
      userId: p.userId,
      slot: p.slot,
      total: p.total,
      username: p.user.username,
      avatar: p.user.avatar,
    })),
    drops: b.drops.map((d) => ({
      userId: d.userId,
      round: d.round,
      price: d.price,
      item: { name: d.item.name, rarity: d.item.rarity, image: d.item.image },
    })),
  };
}
export type BattleView = NonNullable<Awaited<ReturnType<typeof battleView>>>;

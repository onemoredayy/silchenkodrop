import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { itemPrice } from "@/lib/pricing";
import { rateLimit } from "@/lib/ratelimit";
import { round2 } from "@/lib/format";
import { catalogDisplayName, upgradeChance } from "@/lib/upgrade";

export const dynamic = "force-dynamic";

class UpErr extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// body: { inventoryIds: string[], target: marketHashName }
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Нужно войти через Steam" }, { status: 401 });
  if (user.isBanned) return NextResponse.json({ error: "Аккаунт заблокирован" }, { status: 403 });
  if (!rateLimit(`up:${user.id}`, 1, 2000)) {
    return NextResponse.json({ error: "Слишком часто. Подожди пару секунд" }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { inventoryIds?: unknown; target?: unknown };
  const ids = Array.isArray(body.inventoryIds)
    ? [...new Set(body.inventoryIds.filter((x): x is string => typeof x === "string"))].slice(0, 10)
    : [];
  const targetName = typeof body.target === "string" ? body.target : "";
  if (ids.length === 0) return NextResponse.json({ error: "Выбери предметы для апгрейда" }, { status: 400 });
  if (!targetName) return NextResponse.json({ error: "Выбери цель" }, { status: 400 });

  const { upgradeEdge, upgradeMaxChance } = await getSettings();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const target = await tx.skinCatalog.findUnique({ where: { marketHashName: targetName } });
      if (!target?.price) throw new UpErr("У этого скина нет цены");

      const stake = await tx.inventoryItem.findMany({
        where: { id: { in: ids }, userId: user.id, isSold: false },
        include: { item: { include: { catalog: true } } },
      });
      if (stake.length !== ids.length) throw new UpErr("Часть предметов уже не в инвентаре");
      const value = round2(stake.reduce((s, r) => s + itemPrice(r.item), 0));
      if (target.price <= value) throw new UpErr("Цель должна быть дороже ставки");

      const chance = upgradeChance(value, target.price, upgradeEdge, upgradeMaxChance);
      if (chance < 0.5) throw new UpErr("Шанс слишком маленький — выбери цель подешевле");

      // списываем ставку (isSold:false в условии — защита от двойного использования)
      const taken = await tx.inventoryItem.updateMany({
        where: { id: { in: ids }, userId: user.id, isSold: false },
        data: { isSold: true, upgraded: true, soldAt: new Date() },
      });
      if (taken.count !== ids.length) throw new UpErr("Часть предметов уже не в инвентаре");

      // честный бросок на сервере
      const roll = randomInt(0, 1_000_000) / 1_000_000;
      const success = roll < chance / 100;

      let item = await tx.item.findFirst({ where: { marketHashName: target.marketHashName } });
      if (!item) {
        item = await tx.item.create({
          data: {
            name: catalogDisplayName(target),
            rarity: target.rarity,
            price: target.price,
            image: target.image,
            wear: target.wear,
            statTrak: target.statTrak,
            marketHashName: target.marketHashName,
          },
        });
      }

      let inventoryId: string | null = null;
      if (success) {
        const inv = await tx.inventoryItem.create({ data: { userId: user.id, itemId: item.id, dropPrice: target.price } });
        inventoryId = inv.id;
      }
      await tx.upgrade.create({
        data: { userId: user.id, fromValue: value, targetId: item.id, targetPrice: target.price, chance, roll, success },
      });
      return { success, roll, chance, inventoryId, value };
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof UpErr) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

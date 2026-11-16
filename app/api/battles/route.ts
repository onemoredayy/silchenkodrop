import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { round2 } from "@/lib/format";
import { BATTLE_MAX_CASES, BATTLE_SIZES, BattleError } from "@/lib/battle";

export const dynamic = "force-dynamic";

// Создать комнату. body: { caseIds: string[] (1..10, повторы можно), players: 2|3|4 }
// Создатель сразу платит за свои кейсы и занимает первое место.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Нужно войти через Steam" }, { status: 401 });
  if (user.isBanned) return NextResponse.json({ error: "Аккаунт заблокирован" }, { status: 403 });
  if (!rateLimit(`battle-new:${user.id}`, 1, 3000)) {
    return NextResponse.json({ error: "Слишком часто" }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { caseIds?: unknown; players?: unknown };
  const caseIds = Array.isArray(body.caseIds) ? body.caseIds.filter((x): x is string => typeof x === "string") : [];
  const maxPlayers = Number(body.players);
  if (caseIds.length < 1 || caseIds.length > BATTLE_MAX_CASES) {
    return NextResponse.json({ error: `Выбери от 1 до ${BATTLE_MAX_CASES} кейсов` }, { status: 400 });
  }
  if (!BATTLE_SIZES.includes(maxPlayers)) {
    return NextResponse.json({ error: "Игроков может быть 2, 3 или 4" }, { status: 400 });
  }

  try {
    const battle = await prisma.$transaction(async (tx) => {
      const cases = await tx.case.findMany({ where: { id: { in: [...new Set(caseIds)] }, isActive: true } });
      const byId = new Map(cases.map((c) => [c.id, c]));
      if (caseIds.some((id) => !byId.has(id))) throw new BattleError("Какой-то кейс больше недоступен");
      const cost = round2(caseIds.reduce((s, id) => s + byId.get(id)!.price, 0));

      const charged = await tx.user.updateMany({
        where: { id: user.id, balance: { gte: cost }, isBanned: false },
        data: { balance: { decrement: cost } },
      });
      if (charged.count === 0) throw new BattleError("Недостаточно средств на балансе", 402);

      const b = await tx.battle.create({
        data: { creatorId: user.id, maxPlayers, caseIds: JSON.stringify(caseIds), cost },
      });
      await tx.battlePlayer.create({ data: { battleId: b.id, userId: user.id, slot: 0 } });
      await tx.transaction.create({
        data: { userId: user.id, type: "BATTLE", amount: -cost, meta: JSON.stringify({ battle: b.id, cases: caseIds.length }) },
      });
      return b;
    });
    return NextResponse.json({ id: battle.id });
  } catch (e) {
    if (e instanceof BattleError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { BattleError, resolveBattle } from "@/lib/battle";

export const dynamic = "force-dynamic";

// Войти в комнату: платишь столько же, сколько создатель. Последний вошедший запускает батл.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Нужно войти через Steam" }, { status: 401 });
  if (user.isBanned) return NextResponse.json({ error: "Аккаунт заблокирован" }, { status: 403 });
  if (!rateLimit(`battle-join:${user.id}`, 2, 2000)) {
    return NextResponse.json({ error: "Слишком часто" }, { status: 429 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const b = await tx.battle.findUnique({ where: { id: params.id }, include: { players: true } });
      if (!b) throw new BattleError("Комната не найдена", 404);
      if (b.status !== "OPEN") throw new BattleError("Батл уже начался или отменён");
      if (b.players.some((p) => p.userId === user.id)) throw new BattleError("Ты уже в этой комнате");
      if (b.players.length >= b.maxPlayers) throw new BattleError("Комната заполнена");

      const charged = await tx.user.updateMany({
        where: { id: user.id, balance: { gte: b.cost }, isBanned: false },
        data: { balance: { decrement: b.cost } },
      });
      if (charged.count === 0) throw new BattleError("Недостаточно средств на балансе", 402);

      // свободное место; уникальный индекс не даст двоим занять одно и то же
      const used = new Set(b.players.map((p) => p.slot));
      const slot = [...Array(b.maxPlayers).keys()].find((s) => !used.has(s))!;
      await tx.battlePlayer.create({ data: { battleId: b.id, userId: user.id, slot } });
      await tx.transaction.create({
        data: { userId: user.id, type: "BATTLE", amount: -b.cost, meta: JSON.stringify({ battle: b.id }) },
      });

      if (b.players.length + 1 === b.maxPlayers) await resolveBattle(tx, b.id);
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof BattleError) return NextResponse.json({ error: e.message }, { status: e.status });
    // двое одновременно заняли последнее место
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Место уже заняли, обнови страницу" }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

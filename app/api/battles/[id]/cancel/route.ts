import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { BattleError } from "@/lib/battle";

export const dynamic = "force-dynamic";

// Отменить комнату, пока не все собрались: всем вошедшим возвращаются деньги.
// Отменить может создатель или админ.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Нужно войти через Steam" }, { status: 401 });

  try {
    await prisma.$transaction(async (tx) => {
      const b = await tx.battle.findUnique({ where: { id: params.id }, include: { players: true } });
      if (!b) throw new BattleError("Комната не найдена", 404);
      if (b.creatorId !== user.id && user.role !== "ADMIN") throw new BattleError("Отменить может только создатель", 403);
      // смена статуса с условием — защита от гонки с последним входящим
      const closed = await tx.battle.updateMany({ where: { id: b.id, status: "OPEN" }, data: { status: "CANCELLED", finishedAt: new Date() } });
      if (closed.count === 0) throw new BattleError("Батл уже начался или отменён");
      for (const p of b.players) {
        await tx.user.update({ where: { id: p.userId }, data: { balance: { increment: b.cost } } });
        await tx.transaction.create({
          data: { userId: p.userId, type: "BATTLE_REFUND", amount: b.cost, meta: JSON.stringify({ battle: b.id }) },
        });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof BattleError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

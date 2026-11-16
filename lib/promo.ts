import type { Prisma } from "@prisma/client";
import { round2 } from "./format";

export const PROMO_KINDS = {
  BALANCE: "На баланс, ₽",
  DEPOSIT: "Бонус к пополнению, %",
} as const;

export function normCode(s: string) {
  return s.trim().toUpperCase().replace(/\s+/g, "");
}

type Tx = Prisma.TransactionClient;

// Зачисление пополнения: общий бонус из настроек + бонус от промокода (сгорает после использования).
// Пока платёжки нет, вызывается только из заглушки; при подключении оплаты — звать отсюда.
export async function creditDeposit(tx: Tx, userId: string, paid: number, siteBonusPct: number, meta: Record<string, unknown> = {}) {
  const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { depositBonus: true, depositPromo: true } });
  const bonusPct = siteBonusPct + u.depositBonus;
  const credited = round2(paid * (1 + bonusPct / 100));
  await tx.user.update({
    where: { id: userId },
    data: { balance: { increment: credited }, depositBonus: 0, depositPromo: null },
  });
  await tx.transaction.create({
    data: {
      userId,
      type: "DEPOSIT",
      amount: credited,
      meta: JSON.stringify({ ...meta, paid, bonusPct, promo: u.depositPromo ?? undefined }),
    },
  });
  return credited;
}

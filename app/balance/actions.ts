"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { rateLimit } from "@/lib/ratelimit";
import { round2 } from "@/lib/format";

// Тестовое пополнение (заглушка вместо платёжки)
export async function mockDeposit(formData: FormData) {
  const user = await requireUser();
  if (user.isBanned) return;
  if (!rateLimit(`dep:${user.id}`, 5, 60_000)) return;
  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount) || amount < 10 || amount > 100_000) return;
  const { depositBonus } = await getSettings();
  const credited = round2(amount * (1 + depositBonus / 100));
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { balance: { increment: credited } } }),
    prisma.transaction.create({
      data: { userId: user.id, type: "DEPOSIT", amount: credited, meta: JSON.stringify({ mock: true, paid: amount }) },
    }),
  ]);
  revalidatePath("/", "layout");
}

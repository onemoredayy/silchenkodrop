"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { normCode } from "@/lib/promo";

class PromoErr extends Error {}

const back = (q: Record<string, string>) => `/balance?${new URLSearchParams(q)}`;

export async function activatePromo(formData: FormData) {
  const user = await requireUser();
  if (user.isBanned) redirect(back({ error: "Аккаунт заблокирован" }));
  if (!rateLimit(`promo:${user.id}`, 5, 60_000)) redirect(back({ error: "Слишком много попыток, подожди минуту" }));
  const code = normCode(String(formData.get("code") ?? ""));
  if (!code) redirect(back({ error: "Введи промокод" }));

  let msg = "";
  try {
    msg = await prisma.$transaction(async (tx) => {
      const p = await tx.promo.findUnique({ where: { code } });
      if (!p || !p.isActive) throw new PromoErr("Такого промокода нет");
      if (p.expiresAt && p.expiresAt < new Date()) throw new PromoErr("Срок действия промокода закончился");
      if (await tx.promoUse.findUnique({ where: { promoId_userId: { promoId: p.id, userId: user.id } } })) {
        throw new PromoErr("Ты уже активировал этот промокод");
      }
      // счётчик с условием — чтобы лимит не превысили одновременными запросами
      const took = await tx.promo.updateMany({
        where: { id: p.id, isActive: true, ...(p.maxUses > 0 ? { uses: { lt: p.maxUses } } : {}) },
        data: { uses: { increment: 1 } },
      });
      if (took.count === 0) throw new PromoErr("Промокод закончился");
      await tx.promoUse.create({ data: { promoId: p.id, userId: user.id } });

      if (p.kind === "BALANCE") {
        await tx.user.update({ where: { id: user.id }, data: { balance: { increment: p.value } } });
        await tx.transaction.create({
          data: { userId: user.id, type: "PROMO", amount: p.value, meta: JSON.stringify({ code: p.code }) },
        });
        return `Промокод активирован: +${p.value} ₽ на баланс`;
      }
      await tx.user.update({ where: { id: user.id }, data: { depositBonus: p.value, depositPromo: p.code } });
      return `Промокод активирован: +${p.value}% к следующему пополнению`;
    });
  } catch (e) {
    if (e instanceof PromoErr) redirect(back({ error: e.message }));
    if ((e as { code?: string }).code === "P2002") redirect(back({ error: "Ты уже активировал этот промокод" }));
    throw e;
  }
  revalidatePath("/", "layout");
  redirect(back({ msg }));
}

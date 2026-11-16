"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { normCode, PROMO_KINDS } from "@/lib/promo";

const back = (q: Record<string, string>) => `/admin/promos?${new URLSearchParams(q)}`;

export async function createPromo(formData: FormData) {
  await requireAdmin();
  const code = normCode(String(formData.get("code") ?? ""));
  const kind = String(formData.get("kind") ?? "");
  const value = Number(String(formData.get("value") ?? "").replace(",", "."));
  const maxUses = Math.max(0, Math.floor(Number(formData.get("maxUses")) || 0));
  const days = Number(formData.get("days")) || 0;

  if (!/^[A-Z0-9А-ЯЁ_-]{3,32}$/.test(code)) redirect(back({ error: "Код: 3–32 символа, буквы, цифры, - и _" }));
  if (!(kind in PROMO_KINDS)) redirect(back({ error: "Выбери тип промокода" }));
  if (!Number.isFinite(value) || value <= 0 || (kind === "DEPOSIT" && value > 500) || value > 1_000_000) {
    redirect(back({ error: "Неверное значение" }));
  }
  if (await prisma.promo.findUnique({ where: { code } })) redirect(back({ error: `Промокод ${code} уже есть` }));

  await prisma.promo.create({
    data: { code, kind, value, maxUses, expiresAt: days > 0 ? new Date(Date.now() + days * 86_400_000) : null },
  });
  revalidatePath("/admin/promos");
  redirect(back({ ok: "1" }));
}

export async function togglePromo(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const p = await prisma.promo.findUnique({ where: { id } });
  if (p) await prisma.promo.update({ where: { id }, data: { isActive: !p.isActive } });
  revalidatePath("/admin/promos");
  redirect("/admin/promos");
}

export async function deletePromo(formData: FormData) {
  await requireAdmin();
  await prisma.promo.delete({ where: { id: String(formData.get("id")) } }).catch(() => null);
  revalidatePath("/admin/promos");
  redirect("/admin/promos");
}

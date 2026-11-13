import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { sellPrice } from "@/lib/pricing";
import { rateLimit } from "@/lib/ratelimit";
import { round2 } from "@/lib/format";

export const dynamic = "force-dynamic";

// body: { ids: string[] }  или  { all: true }
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Нужно войти через Steam" }, { status: 401 });
  if (user.isBanned) return NextResponse.json({ error: "Аккаунт заблокирован" }, { status: 403 });
  if (!rateLimit(`sell:${user.id}`, 5, 5000)) {
    return NextResponse.json({ error: "Слишком часто" }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { ids?: unknown; all?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
  if (!body.all && ids.length === 0) {
    return NextResponse.json({ error: "Не выбраны предметы" }, { status: 400 });
  }

  const { sellCommission } = await getSettings();

  const result = await prisma.$transaction(async (tx) => {
    const items = await tx.inventoryItem.findMany({
      where: { userId: user.id, isSold: false, ...(body.all ? {} : { id: { in: ids } }) },
      include: { item: { include: { catalog: true } } },
    });
    let total = 0;
    let sold = 0;
    for (const inv of items) {
      const price = sellPrice(inv.item, sellCommission);
      // isSold:false в условии — защита от двойной продажи одного предмета
      const upd = await tx.inventoryItem.updateMany({
        where: { id: inv.id, isSold: false },
        data: { isSold: true, soldPrice: price, soldAt: new Date() },
      });
      if (upd.count === 1) {
        total += price;
        sold++;
      }
    }
    total = round2(total);
    if (sold > 0) {
      await tx.user.update({ where: { id: user.id }, data: { balance: { increment: total } } });
      await tx.transaction.create({
        data: { userId: user.id, type: "SELL", amount: total, meta: JSON.stringify({ count: sold }) },
      });
    }
    const fresh = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { balance: true } });
    return { sold, total, balance: fresh.balance };
  });

  return NextResponse.json(result);
}

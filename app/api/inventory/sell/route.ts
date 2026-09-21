import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireUser } from "@/lib/auth";
import { calcSellPrice, getSettings } from "@/lib/market";
import { rateLimit } from "@/lib/rateLimit";

class SellError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();

    const rl = rateLimit(`sell:${user.id}`, 20, 10_000);
    if (!rl.ok) return fail("Слишком часто. Подожди немного.", 429);

    let body: { inventoryId?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      throw new SellError("Некорректный запрос", 400);
    }
    const inventoryId = typeof body.inventoryId === "string" ? body.inventoryId : "";
    if (!inventoryId) throw new SellError("Не указан предмет", 400);

    const result = await prisma.$transaction(async (tx) => {
      const inv = await tx.inventoryItem.findFirst({
        where: { id: inventoryId, userId: user.id, isSold: false },
        include: { item: true },
      });
      if (!inv) throw new SellError("Предмет не найден или уже продан", 404);

      const { sellCommission } = await getSettings(tx);
      const soldPrice = calcSellPrice(inv.item.price, sellCommission);

      // Условное обновление: второй запрос на тот же предмет ничего не найдёт
      const upd = await tx.inventoryItem.updateMany({
        where: { id: inv.id, userId: user.id, isSold: false },
        data: { isSold: true, soldPrice },
      });
      if (upd.count === 0) throw new SellError("Предмет уже продан", 409);

      const updated = await tx.user.update({
        where: { id: user.id },
        data: { balance: { increment: soldPrice } },
        select: { balance: true },
      });
      await tx.transaction.create({
        data: {
          userId: user.id,
          type: "SELL_ITEM",
          amount: soldPrice,
          meta: JSON.stringify({ inventoryId: inv.id, itemId: inv.itemId }),
        },
      });
      return { soldPrice, balance: updated.balance };
    });

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AuthError || e instanceof SellError) {
      return fail(e.message, e.status);
    }
    console.error("sell error", e);
    return fail("Ошибка сервера", 500);
  }
}

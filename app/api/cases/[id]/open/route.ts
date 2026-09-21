import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, requireUser } from "@/lib/auth";
import { pickWeighted, validateChances } from "@/lib/rng";
import { rateLimit } from "@/lib/rateLimit";

class OpenError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function fail(message: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json({ error: message }, { status, headers });
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();

    // Защита от спама и двойных нажатий
    const rl = rateLimit(`open:${user.id}`, 5, 10_000);
    if (!rl.ok) {
      const sec = Math.ceil(rl.retryAfterMs / 1000);
      return fail(`Слишком часто. Подожди ${sec} с.`, 429, {
        "Retry-After": String(sec),
      });
    }

    const c = await prisma.case.findUnique({
      where: { id: params.id },
      include: { items: { include: { item: true } } },
    });
    if (!c || !c.isActive) throw new OpenError("Кейс не найден", 404);

    // Шансы проверяются на сервере перед каждым открытием
    try {
      validateChances(c.items);
    } catch {
      throw new OpenError("Кейс настроен неверно, обратись к админу", 500);
    }

    const caseId = c.id;
    const price = c.price; // цена только из базы
    const won = pickWeighted(c.items).item; // выбор предмета только на сервере

    const result = await prisma.$transaction(async (tx) => {
      // Списание одним условным запросом: пройдёт, только если денег хватает
      const paid = await tx.user.updateMany({
        where: { id: user.id, isBanned: false, balance: { gte: price } },
        data: { balance: { decrement: price } },
      });
      if (paid.count === 0) throw new OpenError("Недостаточно средств", 402);

      const opening = await tx.opening.create({
        data: { userId: user.id, caseId, itemId: won.id, pricePaid: price },
      });
      const inv = await tx.inventoryItem.create({
        data: { userId: user.id, itemId: won.id },
      });
      await tx.transaction.create({
        data: {
          userId: user.id,
          type: "OPEN_CASE",
          amount: -price,
          meta: JSON.stringify({ caseId, itemId: won.id, openingId: opening.id }),
        },
      });
      const fresh = await tx.user.findUnique({
        where: { id: user.id },
        select: { balance: true },
      });
      return { inventoryId: inv.id, balance: fresh?.balance ?? 0 };
    });

    return NextResponse.json({
      item: {
        id: result.inventoryId,
        name: won.name,
        rarity: won.rarity,
        price: won.price,
        image: won.image,
        wear: won.wear,
        statTrak: won.statTrak,
      },
      balance: result.balance,
    });
  } catch (e) {
    if (e instanceof AuthError || e instanceof OpenError) {
      return fail(e.message, e.status);
    }
    console.error("open case error", e);
    return fail("Ошибка сервера", 500);
  }
}

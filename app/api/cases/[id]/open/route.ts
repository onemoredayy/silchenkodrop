import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { pickWeighted } from "@/lib/rng";
import { itemPrice } from "@/lib/pricing";
import { rateLimit } from "@/lib/ratelimit";
import { round2 } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { randomInt } from "crypto";

export const dynamic = "force-dynamic";

class OpenError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Нужно войти через Steam" }, { status: 401 });
  if (user.isBanned) return NextResponse.json({ error: "Аккаунт заблокирован" }, { status: 403 });

  // не чаще 1 открытия в 2 секунды и 20 в минуту
  if (!rateLimit(`open:${user.id}`, 1, 2000) || !rateLimit(`open-m:${user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: "Слишком часто. Подожди пару секунд" }, { status: 429 });
  }

  const { trollChance } = await getSettings();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const kase = await tx.case.findUnique({
        where: { id: params.id },
        include: { items: { include: { item: { include: { catalog: true } } } } },
      });
      if (!kase || !kase.isActive) throw new OpenError("Кейс не найден", 404);
      const rows = kase.items.filter((r) => r.dropChance > 0);
      if (rows.length === 0) throw new OpenError("Кейс пустой");
      const sum = rows.reduce((s, r) => s + r.dropChance, 0);
      if (Math.abs(sum - 100) > 0.01) throw new OpenError("Шансы кейса настроены неверно (сумма ≠ 100%)");

      // Атомарное списание: пройдёт, только если денег хватает прямо сейчас
      const charged = await tx.user.updateMany({
        where: { id: user.id, balance: { gte: kase.price }, isBanned: false },
        data: { balance: { decrement: kase.price } },
      });
      if (charged.count === 0) throw new OpenError("Недостаточно средств на балансе", 402);

      const win = pickWeighted(rows);
      const price = round2(itemPrice(win.item));

      await tx.opening.create({
        data: { userId: user.id, caseId: kase.id, itemId: win.itemId, pricePaid: kase.price, itemPrice: price },
      });
      const inv = await tx.inventoryItem.create({
        data: { userId: user.id, itemId: win.itemId, dropPrice: price },
      });
      await tx.transaction.create({
        data: {
          userId: user.id,
          type: "OPEN",
          amount: -kase.price,
          meta: JSON.stringify({ case: kase.name, item: win.item.name }),
        },
      });
      const fresh = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { balance: true } });

      // «Пук-прокрутка»: только визуал. Предмет уже выбран выше честным RNG,
      // лента лишь сначала притормозит на самом дорогом предмете кейса.
      const top = rows.reduce((a, b) => (itemPrice(b.item) > itemPrice(a.item) ? b : a));
      const troll =
        top.itemId !== win.itemId &&
        itemPrice(top.item) > price * 2 &&
        randomInt(0, 10_000) < Math.round(trollChance * 100)
          ? {
              id: top.item.id,
              name: top.item.name,
              rarity: top.item.rarity,
              image: top.item.image,
              wear: top.item.wear,
              price: round2(itemPrice(top.item)),
            }
          : null;

      return {
        troll,
        inventoryId: inv.id,
        balance: fresh.balance,
        item: {
          id: win.item.id,
          name: win.item.name,
          rarity: win.item.rarity,
          image: win.item.image,
          wear: win.item.wear,
          price,
        },
      };
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof OpenError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

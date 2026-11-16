import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { itemPrice } from "@/lib/pricing";
import { rateLimit } from "@/lib/ratelimit";
import { round2 } from "@/lib/format";
import { CONTRACT_MAX, CONTRACT_MIN, contractMultiplier, itemForCatalog, pickCatalogNear } from "@/lib/contract";

export const dynamic = "force-dynamic";

class CErr extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// body: { inventoryIds: string[] } — 3..10 своих скинов
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Нужно войти через Steam" }, { status: 401 });
  if (user.isBanned) return NextResponse.json({ error: "Аккаунт заблокирован" }, { status: 403 });
  if (!rateLimit(`contract:${user.id}`, 1, 2000)) {
    return NextResponse.json({ error: "Слишком часто. Подожди пару секунд" }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { inventoryIds?: unknown };
  const ids = Array.isArray(body.inventoryIds)
    ? [...new Set(body.inventoryIds.filter((x): x is string => typeof x === "string"))]
    : [];
  if (ids.length < CONTRACT_MIN || ids.length > CONTRACT_MAX) {
    return NextResponse.json({ error: `Нужно от ${CONTRACT_MIN} до ${CONTRACT_MAX} скинов` }, { status: 400 });
  }

  const { contractReturn } = await getSettings();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const stake = await tx.inventoryItem.findMany({
        where: { id: { in: ids }, userId: user.id, isSold: false },
        include: { item: { include: { catalog: true } } },
      });
      if (stake.length !== ids.length) throw new CErr("Часть предметов уже не в инвентаре");
      const value = round2(stake.reduce((s, r) => s + itemPrice(r.item), 0));
      if (value <= 0) throw new CErr("У этих скинов нет цены");

      const taken = await tx.inventoryItem.updateMany({
        where: { id: { in: ids }, userId: user.id, isSold: false },
        data: { isSold: true, upgraded: true, soldAt: new Date() },
      });
      if (taken.count !== ids.length) throw new CErr("Часть предметов уже не в инвентаре");

      // честный бросок на сервере: сначала во сколько раз, потом конкретный скин такой цены
      const mult = contractMultiplier(contractReturn);
      const cat = await pickCatalogNear(tx, value * mult);
      if (!cat?.price) throw new CErr("В каталоге нет скинов с ценами — обнови цены в админке", 500);

      const item = await itemForCatalog(tx, cat);
      const inv = await tx.inventoryItem.create({ data: { userId: user.id, itemId: item.id, dropPrice: cat.price } });
      await tx.contract.create({
        data: { userId: user.id, inputCount: ids.length, inputValue: value, resultId: item.id, resultPrice: cat.price },
      });
      return {
        inventoryId: inv.id,
        value,
        item: { id: item.id, name: item.name, rarity: item.rarity, image: item.image, wear: item.wear, price: cat.price },
      };
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof CErr) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// «Голда» — особый предмет: при выпадении вместо себя кладёт в инвентарь ВСЕ скины своего кейса.
// Создаётся сам при старте сервера и один раз добавляется в кейс «Жирный уебан» с шансом 0,1%.
// Дальше шанс крутится в админке, в редакторе шансов кейса, как у любого предмета.
import type { PrismaClient } from "@prisma/client";
import { itemPrice } from "./pricing";

export const GOLD_NAME = "Голда";
const GOLD_KEY = "goldItemId";
const LINKED_KEY = "goldLinkedCase";
const TARGET_CASE = "жирный уебан";
const START_CHANCE = 0.1;

export async function goldItemId(db: Pick<PrismaClient, "siteSetting">) {
  return (await db.siteSetting.findUnique({ where: { key: GOLD_KEY } }))?.value ?? null;
}

export async function ensureGold(prisma: PrismaClient, log: (m: string) => void = console.log) {
  let id = await goldItemId(prisma);
  if (!id || !(await prisma.item.findUnique({ where: { id } }))) {
    const item = await prisma.item.create({ data: { name: GOLD_NAME, rarity: "GOLD", price: 0, image: "/items/gold.svg" } });
    id = item.id;
    await prisma.siteSetting.upsert({ where: { key: GOLD_KEY }, update: { value: id }, create: { key: GOLD_KEY, value: id } });
    log("создан предмет «Голда»");
  }

  // один раз кладём в «Жирный уебан» (если админ потом уберёт — обратно не вернём)
  if (!(await prisma.siteSetting.findUnique({ where: { key: LINKED_KEY } }))) {
    const cases = await prisma.case.findMany({ select: { id: true, name: true } });
    const kase = cases.find((c) => c.name.toLowerCase().replace(/ё/g, "е").includes(TARGET_CASE));
    if (kase) {
      const rows = await prisma.caseItem.findMany({ where: { caseId: kase.id } });
      if (!rows.some((r) => r.itemId === id)) {
        // остальные шансы чуть ужимаем, чтобы сумма осталась 100%
        const k = (100 - START_CHANCE) / 100;
        const scaled = rows.map((r) => ({ id: r.id, c: Math.floor(r.dropChance * k * 10000) / 10000 }));
        const diff = Math.round((100 - START_CHANCE - scaled.reduce((s, r) => s + r.c, 0)) * 10000) / 10000;
        if (scaled.length) scaled.sort((a, b) => b.c - a.c)[0].c = Math.round((scaled[0].c + diff) * 10000) / 10000;
        await prisma.$transaction([
          ...scaled.map((r) => prisma.caseItem.update({ where: { id: r.id }, data: { dropChance: r.c } })),
          prisma.caseItem.create({ data: { caseId: kase.id, itemId: id!, dropChance: START_CHANCE } }),
        ]);
        log(`«Голда» добавлена в кейс «${kase.name}» с шансом ${START_CHANCE}%`);
      }
      await prisma.siteSetting.create({ data: { key: LINKED_KEY, value: kase.id } });
    }
  }

  // цена голды = всё содержимое кейса (берём самый дорогой из кейсов, где она лежит)
  const links = await prisma.caseItem.findMany({
    where: { itemId: id },
    include: { case: { include: { items: { include: { item: { include: { catalog: true } } } } } } },
  });
  let price = 0;
  for (const l of links) {
    const sum = l.case.items.filter((r) => r.itemId !== id).reduce((s, r) => s + itemPrice(r.item), 0);
    price = Math.max(price, Math.round(sum * 100) / 100);
  }
  await prisma.item.update({ where: { id }, data: { price } });
}

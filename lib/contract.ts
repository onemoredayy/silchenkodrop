import { randomInt } from "crypto";
import type { Prisma } from "@prisma/client";
import { EXTRA_CATEGORIES } from "./junk-cases";
import { catalogDisplayName } from "./upgrade";

export const CONTRACT_MIN = 3;
export const CONTRACT_MAX = 10;
export const MULT_MIN = 0.2; // худший исход — 20% от вложенного
export const MULT_MAX = 5; // лучший — 500%

// Во сколько раз результат дороже вложенного. Чаще всего около средней отдачи,
// изредка заметно больше. Среднее ≈ ret/100.
export function contractMultiplier(retPct: number) {
  const mean = Math.max(MULT_MIN + 0.05, retPct / 100);
  const u = (randomInt(1, 1_000_000) / 1_000_000) as number;
  // экспоненциальный «хвост» над минимумом
  const m = MULT_MIN - (mean - MULT_MIN) * Math.log(u);
  return Math.min(MULT_MAX, m);
}

type Tx = Prisma.TransactionClient;
const notExtra = { OR: [{ category: null }, { category: { notIn: EXTRA_CATEGORIES } }] };

// Случайный скин каталога с ценой около target: сначала ±10%, потом ±25%, потом ближайший
export async function pickCatalogNear(tx: Tx, target: number) {
  for (const spread of [0.1, 0.25]) {
    const where = { price: { gte: target * (1 - spread), lte: target * (1 + spread) }, ...notExtra };
    const count = await tx.skinCatalog.count({ where });
    if (count > 0) {
      return tx.skinCatalog.findFirst({ where, skip: randomInt(0, count), orderBy: { marketHashName: "asc" } });
    }
  }
  const [below, above] = await Promise.all([
    tx.skinCatalog.findFirst({ where: { price: { gt: 0, lte: target }, ...notExtra }, orderBy: { price: "desc" } }),
    tx.skinCatalog.findFirst({ where: { price: { gt: target }, ...notExtra }, orderBy: { price: "asc" } }),
  ]);
  if (!below) return above;
  if (!above) return below;
  return target - below.price! <= above.price! - target ? below : above;
}

// Item для предмета каталога (создаётся при первом выпадении)
export async function itemForCatalog(
  tx: Tx,
  c: { marketHashName: string; baseName: string; statTrak: boolean; rarity: string; price: number | null; image: string | null; wear: string | null },
) {
  return (
    (await tx.item.findFirst({ where: { marketHashName: c.marketHashName } })) ??
    (await tx.item.create({
      data: {
        name: catalogDisplayName(c),
        rarity: c.rarity,
        price: c.price ?? 0,
        image: c.image,
        wear: c.wear,
        statTrak: c.statTrak,
        marketHashName: c.marketHashName,
      },
    }))
  );
}

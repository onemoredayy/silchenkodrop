import { round2 } from "./format";

type PricedItem = {
  price: number;
  catalog?: { price: number | null } | null;
};

// Цена скина: из каталога Steam, если связан и цена есть; иначе — ручная
export function itemPrice(item: PricedItem) {
  const p = item.catalog?.price;
  return p != null && p > 0 ? p : item.price;
}

export function sellPrice(item: PricedItem, commissionPct: number) {
  return round2(itemPrice(item) * (1 - commissionPct / 100));
}

// Подсказка для админа: «честная» стоимость кейса + маржа
export function suggestedCasePrice(
  rows: { dropChance: number; item: PricedItem }[],
  marginPct: number,
) {
  const ev = rows.reduce((s, r) => s + itemPrice(r.item) * (r.dropChance / 100), 0);
  return { ev: round2(ev), suggested: round2(ev * (1 + marginPct / 100)) };
}

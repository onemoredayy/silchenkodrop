// «Обычные кейсы»: все оружейные кейсы CS с настоящим содержимым и шансами как в игре.
import type { PrismaClient } from "@prisma/client";
import { CRATES_URL, findDefault } from "./catalog";
import { mapCatalogRarity } from "./rarity";

type RawCrate = {
  id: string;
  name: string;
  type: string | null;
  image?: string | null;
  first_sale_date?: string | null;
  contains?: { name: string; rarity?: { id?: string } }[];
  contains_rare?: { name: string; rarity?: { id?: string } }[];
};

// Официальные шансы Valve по редкостям (в сумме 100%)
const ODDS: Record<string, number> = {
  RARE: 79.92, // армейское
  MYTHICAL: 15.98, // запрещённое
  LEGENDARY: 3.2, // засекреченное
  ANCIENT: 0.64, // тайное
  GOLD: 0.26, // нож / перчатки
};

// Запасные цены, если цены Steam ещё не загружены
const FALLBACK: Record<string, number> = { COMMON: 3, UNCOMMON: 10, RARE: 15, MYTHICAL: 80, LEGENDARY: 400, ANCIENT: 2000, GOLD: 15000 };

const RU: Record<string, string> = {
  "CS:GO Weapon Case": "Оружейный кейс CS:GO",
  "CS:GO Weapon Case 2": "Оружейный кейс CS:GO 2",
  "CS:GO Weapon Case 3": "Оружейный кейс CS:GO 3",
};

function slugify(name: string) {
  return "cs-" + name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function importOfficialCases(prisma: PrismaClient, sectionId: string, marginPct = 15, log = console.log) {
  log("Обычные кейсы: скачиваю список…");
  const res = await fetch(CRATES_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Список кейсов не скачался: HTTP ${res.status}`);
  const crates = ((await res.json()) as RawCrate[])
    .filter((c) => c.type === "Case")
    .sort((a, b) => (b.first_sale_date ?? "").localeCompare(a.first_sale_date ?? ""));

  const itemCache = new Map<string, { id: string; price: number } | null>();
  async function itemFor(name: string, rarity: string) {
    if (itemCache.has(name)) return itemCache.get(name)!;
    const cat = await findDefault(prisma, name);
    if (!cat) {
      itemCache.set(name, null);
      return null;
    }
    const data = {
      name,
      rarity,
      price: cat.price ?? FALLBACK[rarity] ?? 0,
      image: cat.image,
      wear: cat.wear,
      marketHashName: cat.marketHashName,
    };
    const existing = await prisma.item.findFirst({ where: { marketHashName: cat.marketHashName } });
    const item = existing
      ? await prisma.item.update({ where: { id: existing.id }, data })
      : await prisma.item.create({ data });
    const v = { id: item.id, price: cat.price ?? data.price };
    itemCache.set(name, v);
    return v;
  }

  let order = 0;
  for (const crate of crates) {
    // уникальные предметы с редкостью
    const list = new Map<string, string>();
    for (const it of crate.contains ?? []) list.set(it.name, mapCatalogRarity(it.rarity?.id, it.name));
    for (const it of crate.contains_rare ?? []) list.set(it.name, "GOLD");

    const tiers = new Map<string, { id: string; price: number }[]>();
    for (const [name, rarity] of list) {
      const tier = ODDS[rarity] ? rarity : "RARE";
      const item = await itemFor(name, rarity);
      if (!item) continue;
      const arr = tiers.get(tier) ?? [];
      arr.push(item);
      tiers.set(tier, arr);
    }
    if (tiers.size === 0) continue;

    // шанс уровня делим поровну между предметами; если уровня нет — его шанс уходит армейскому
    const present = Object.keys(ODDS).filter((t) => tiers.has(t));
    const missing = Object.keys(ODDS).filter((t) => !tiers.has(t)).reduce((s, t) => s + ODDS[t], 0);
    const rows: { itemId: string; dropChance: number; price: number }[] = [];
    for (const t of present) {
      const tierChance = ODDS[t] + (t === present[0] ? missing : 0);
      const arr = tiers.get(t)!;
      for (const it of arr) rows.push({ itemId: it.id, dropChance: Math.floor((tierChance / arr.length) * 10000) / 10000, price: it.price });
    }
    const diff = Math.round((100 - rows.reduce((s, r) => s + r.dropChance, 0)) * 10000) / 10000;
    rows[0].dropChance = Math.round((rows[0].dropChance + diff) * 10000) / 10000;

    const ev = rows.reduce((s, r) => s + (r.price * r.dropChance) / 100, 0);
    const price = Math.max(10, Math.round(ev * (1 + marginPct / 100)));

    const slug = slugify(crate.name);
    const existing = await prisma.case.findUnique({ where: { slug } });
    const kase = existing
      ? await prisma.case.update({ where: { id: existing.id }, data: { image: crate.image ?? existing.image, officialId: crate.id } })
      : await prisma.case.create({
          data: {
            name: RU[crate.name] ?? crate.name,
            slug,
            price, // дальше цену меняешь сам в админке — повторный импорт её не трогает
            image: crate.image ?? null,
            description: `Настоящее содержимое и шансы «${crate.name}».`,
            sectionId,
            sortOrder: order,
            officialId: crate.id,
          },
        });
    order++;
    if (!existing) {
      await prisma.caseItem.createMany({ data: rows.map(({ itemId, dropChance }) => ({ caseId: kase.id, itemId, dropChance })) });
    }
    log(`  ${crate.name}: ${rows.length} предметов${existing ? " (уже был)" : `, цена ${price} ₽`}`);
  }
}

// Блок «Шелупонь»: наклейки, значки (пины), нашивки и кейс со всякой всячиной.
// Предметы берутся из ByMykel/CSGO-API, цены — те же, что у скинов (Steam Market).
// Без зависимостей от Next — используется в seed и при старте сервера.
import type { PrismaClient } from "@prisma/client";
import { API } from "./catalog";
import { updateAllPrices } from "./prices";

type Raw = {
  name?: string;
  market_hash_name?: string | null;
  type?: string | null;
  rarity?: { id?: string; color?: string } | null;
  image?: string | null;
};

// category — как предмет помечен в каталоге, weapon — как он называется в фильтре каталога
const SOURCES: { file: string; category: string; weapon: string; only?: (r: Raw) => boolean }[] = [
  { file: "stickers.json", category: "Sticker", weapon: "Наклейка" },
  { file: "patches.json", category: "Patch", weapon: "Нашивка" },
  {
    file: "collectibles.json",
    category: "Pin",
    weapon: "Значок",
    // в этом файле ещё медали и монеты — их на рынке нет, берём только значки
    only: (r) => /pin/i.test(r.type ?? "") || /\bPin$/.test(r.name ?? ""),
  },
  { file: "keychains.json", category: "Charm", weapon: "Брелок" },
  { file: "agents.json", category: "Agent", weapon: "Агент" },
  { file: "music_kits.json", category: "Music Kit", weapon: "Набор музыки" },
];

// Всё, что не оружие. В апгрейде такие предметы целью не предлагаются.
export const EXTRA_CATEGORIES = SOURCES.map((s) => s.category);

export const JUNK_SECTION = { slug: "shelupon", name: "Шелупонь" };
const READY_KEY = "junkCasesReady";
const TRIES_KEY = "junkCasesTries";
const MAX_TRIES = 5;

function rarityOf(id = "") {
  if (id.includes("contraband")) return "GOLD";
  if (id.includes("uncommon")) return "UNCOMMON";
  if (id.includes("common")) return "COMMON";
  if (id.includes("mythical")) return "MYTHICAL";
  if (id.includes("legendary")) return "LEGENDARY";
  if (id.includes("ancient")) return "ANCIENT";
  return "RARE";
}

// Скачивает списки и добавляет в каталог то, чего там ещё нет
async function importExtras(prisma: PrismaClient, log: (m: string) => void) {
  const existing = new Set(
    (await prisma.skinCatalog.findMany({ select: { marketHashName: true } })).map((r) => r.marketHashName),
  );
  let added = 0;
  for (const src of SOURCES) {
    try {
      const res = await fetch(`${API}/${src.file}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = (await res.json()) as Raw[];
      const rows = [];
      for (const r of raw) {
        const mhn = r?.market_hash_name ?? r?.name;
        if (!mhn || existing.has(mhn) || (src.only && !src.only(r))) continue;
        existing.add(mhn);
        rows.push({
          marketHashName: mhn,
          baseName: mhn,
          name: mhn,
          weapon: src.weapon,
          category: src.category,
          rarity: rarityOf(r.rarity?.id),
          rarityColor: r.rarity?.color ?? null,
          wear: null,
          statTrak: false,
          isDefault: true,
          image: r.image ?? null,
        });
      }
      for (let i = 0; i < rows.length; i += 500) {
        await prisma.skinCatalog.createMany({ data: rows.slice(i, i + 500) });
      }
      added += rows.length;
      log(`Шелупонь: ${src.weapon.toLowerCase()} — новых ${rows.length}`);
    } catch (e) {
      log(`! Шелупонь: ${src.file} не загрузился: ${(e as Error).message}`);
    }
  }
  return added;
}

// n предметов, равномерно растянутых по цене от дешёвых к дорогим (по логарифму цены)
export function spread<T extends { price: number }>(pool: T[], n: number, min = 0, max = Infinity): T[] {
  const list = pool.filter((p) => p.price > 0 && p.price >= min && p.price <= max).sort((a, b) => a.price - b.price);
  if (list.length <= n) return list;
  const lo = Math.log(list[0].price);
  const hi = Math.log(list[list.length - 1].price);
  const used = new Set<number>();
  for (let k = 0; k < n; k++) {
    const want = lo + ((hi - lo) * k) / (n - 1);
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < list.length; i++) {
      if (used.has(i)) continue;
      const d = Math.abs(Math.log(list[i].price) - want);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    used.add(best);
  }
  return [...used].sort((a, b) => a - b).map((i) => list[i]);
}

// Шансы в %: чем дороже предмет, тем реже. В сумме ровно 100.
export function chancesFor(prices: number[]): number[] {
  const weights = prices.map((p) => Math.pow(Math.max(p, 0.01), -0.85));
  const total = weights.reduce((a, b) => a + b, 0);
  const out = weights.map((w) => Math.max(0.0001, Math.floor((w / total) * 100 * 10000) / 10000));
  // погрешность округления уходит самому частому предмету
  const top = out.indexOf(Math.max(...out));
  const diff = 100 - out.reduce((a, b) => a + b, 0);
  out[top] = Math.round((out[top] + diff) * 10000) / 10000;
  return out;
}

type Cat = {
  marketHashName: string;
  name: string;
  rarity: string;
  image: string | null;
  wear: string | null;
  statTrak: boolean;
  price: number | null;
};
type Priced = Cat & { price: number };

type Spec = {
  slug: string;
  name: string;
  description: string;
  pick: (pools: Record<string, Priced[]>, skins: Priced[]) => Priced[];
};

const SPECS: Spec[] = [
  {
    slug: "nakleyki-1",
    name: "Наклейки#1",
    description: "Дешёвые наклейки. Залепить калаш на сдачу.",
    pick: (p) => spread(p.Sticker ?? [], 14, 1, 250),
  },
  {
    slug: "nakleyki-2",
    name: "Наклейки#2",
    description: "Наклейки посерьёзнее: голо, фольга и турнирные.",
    pick: (p) => spread(p.Sticker ?? [], 14, 25, 3000),
  },
  {
    slug: "nakleyki-3",
    name: "Наклейки#3",
    description: "Дорогие наклейки вплоть до самых редких на рынке.",
    pick: (p) => spread(p.Sticker ?? [], 14, 400),
  },
  {
    slug: "piny",
    name: "Пины",
    description: "Коллекционные значки. На рюкзак в профиле.",
    pick: (p) => spread(p.Pin ?? [], 14),
  },
  {
    slug: "nashivki",
    name: "Нашивки",
    description: "Нашивки для агентов.",
    pick: (p) => spread(p.Patch ?? [], 14),
  },
  {
    slug: "eto-che-vasche",
    name: "Это че ваще нахуй",
    description: "Сюда свалено всё подряд: брелоки, агенты, музыка, наклейки, нашивки, значки, самый дешёвый скин и нож.",
    pick: (p, skins) => [...EXTRA_CATEGORIES.flatMap((c) => spread(p[c] ?? [], 3)), ...skins],
  },
];

const STICKER_SLUGS = ["nakleyki-1", "nakleyki-2", "nakleyki-3"];

export async function importJunkCases(prisma: PrismaClient, log: (m: string) => void = console.log) {
  await importExtras(prisma, log);
  await updateAllPrices(prisma, log);

  const select = { marketHashName: true, name: true, rarity: true, image: true, wear: true, statTrak: true, price: true };
  const pools: Record<string, Priced[]> = {};
  for (const category of EXTRA_CATEGORIES) {
    const rows: Cat[] = await prisma.skinCatalog.findMany({ where: { category, price: { gt: 0 } }, select });
    pools[category] = rows.filter((r): r is Priced => r.price != null);
  }
  if (!pools.Sticker?.length) throw new Error("у наклеек нет цен — список или цены не загрузились");

  // для кейса со всякой всячиной: самый дешёвый скин и самый дорогой нож/перчатки
  const notExtra = { OR: [{ category: null }, { category: { notIn: EXTRA_CATEGORIES } }] };
  const cheapest: Cat | null = await prisma.skinCatalog.findFirst({
    where: { price: { gt: 0 }, statTrak: false, ...notExtra },
    orderBy: { price: "asc" },
    select,
  });
  const knife: Cat | null = await prisma.skinCatalog.findFirst({
    where: { price: { gt: 0 }, statTrak: false, rarity: "GOLD", ...notExtra },
    orderBy: { price: "desc" },
    select,
  });
  const skins = [cheapest, knife].filter((r): r is Priced => r?.price != null);

  // блок ставим перед «Обычными кейсами», чтобы не листать до него 40 кейсов
  let section = await prisma.caseSection.findUnique({ where: { slug: JUNK_SECTION.slug } });
  if (!section) {
    const official = await prisma.caseSection.findUnique({ where: { slug: "official" } });
    const sortOrder = official ? official.sortOrder : await prisma.caseSection.count();
    if (official) await prisma.caseSection.update({ where: { id: official.id }, data: { sortOrder: sortOrder + 1 } });
    section = await prisma.caseSection.create({ data: { ...JUNK_SECTION, sortOrder } });
  }

  const margin = Number((await prisma.siteSetting.findUnique({ where: { key: "margin" } }))?.value ?? 15) || 0;
  const stickerPrices: number[] = [];
  let ready = 0;

  for (const [order, spec] of SPECS.entries()) {
    const existing = await prisma.case.findUnique({ where: { slug: spec.slug } });
    if (existing) {
      // уже создан — содержимое и цену не трогаем, их мог поменять админ
      if (STICKER_SLUGS.includes(spec.slug)) stickerPrices.push(existing.price);
      ready++;
      continue;
    }
    const seen = new Set<string>();
    const picked = spec.pick(pools, skins).filter((r) => !seen.has(r.marketHashName) && seen.add(r.marketHashName));
    if (picked.length < 5) {
      log(`! ${spec.name}: нашлось только ${picked.length} предметов с ценой, кейс не создан`);
      continue;
    }
    picked.sort((a, b) => a.price - b.price);
    const chances = chancesFor(picked.map((r) => r.price));
    const ev = picked.reduce((s, r, i) => s + (r.price * chances[i]) / 100, 0);
    let price = Math.max(5, Math.round(ev * (1 + margin / 100)));
    // «Наклейки» #1 → #2 → #3 строго по возрастанию цены
    if (STICKER_SLUGS.includes(spec.slug)) {
      const prev = stickerPrices[stickerPrices.length - 1];
      if (prev != null && price <= prev) price = Math.ceil(prev * 1.5);
      stickerPrices.push(price);
    }

    const itemIds: string[] = [];
    for (const r of picked) {
      const item =
        (await prisma.item.findFirst({ where: { marketHashName: r.marketHashName } })) ??
        (await prisma.item.create({
          data: {
            name: r.name,
            rarity: r.rarity,
            price: r.price,
            image: r.image,
            wear: r.wear,
            statTrak: r.statTrak,
            marketHashName: r.marketHashName,
          },
        }));
      itemIds.push(item.id);
    }
    const kase = await prisma.case.create({
      data: {
        name: spec.name,
        slug: spec.slug,
        price, // дальше цену меняешь сам в админке — повторный запуск её не трогает
        description: spec.description,
        image: picked[picked.length - 1].image,
        sectionId: section.id,
        sortOrder: order,
      },
    });
    await prisma.caseItem.createMany({
      data: itemIds.map((itemId, i) => ({ caseId: kase.id, itemId, dropChance: chances[i] })),
    });
    log(`  ${spec.name}: ${picked.length} предметов, цена ${price} ₽`);
    ready++;
  }

  const done = ready === SPECS.length;
  if (done) {
    await prisma.siteSetting.upsert({ where: { key: READY_KEY }, update: { value: "1" }, create: { key: READY_KEY, value: "1" } });
  }
  return done;
}

// При старте сервера: создать блок, если его ещё нет. После нескольких неудач перестаём пытаться.
export async function ensureJunkCases(prisma: PrismaClient, log: (m: string) => void = console.log) {
  const [ready, triesRow] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { key: READY_KEY } }),
    prisma.siteSetting.findUnique({ where: { key: TRIES_KEY } }),
  ]);
  const tries = Number(triesRow?.value) || 0;
  if (ready?.value === "1" || tries >= MAX_TRIES) return;
  await prisma.siteSetting.upsert({
    where: { key: TRIES_KEY },
    update: { value: String(tries + 1) },
    create: { key: TRIES_KEY, value: String(tries + 1) },
  });
  await importJunkCases(prisma, log);
}

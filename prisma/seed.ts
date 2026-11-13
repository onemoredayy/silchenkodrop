// Наполнение базы: каталог скинов, 5 кейсов, админ.
// Запуск: npm run setup   (или повторно: npx tsx prisma/seed.ts)
import { PrismaClient } from "@prisma/client";
import { findDefault, importCatalog } from "../lib/catalog";
import { updateAllPrices } from "../lib/prices";
import { importOfficialCases } from "../lib/official-cases";
import { importJunkCases } from "../lib/junk-cases";
import { DEFAULT_SETTINGS } from "../lib/settings";

const prisma = new PrismaClient();

type Seed = [name: string, rarity: string, price: number];

// Вес выпадения по редкости — потом нормализуется до 100% внутри кейса.
// Шансы можно поменять в админке.
const WEIGHT: Record<string, number> = {
  COMMON: 40,
  UNCOMMON: 25,
  RARE: 15,
  MYTHICAL: 8,
  LEGENDARY: 3,
  ANCIENT: 1,
};

// Блоки на главной. Первые четыре — с кейсами-пустышками, отредактируй их в админке.
const SECTIONS = [
  { slug: "silchenko", name: "СИЛЬЧЕНКО" },
  { slug: "author", name: "Авторский понос" },
  { slug: "rare", name: "Редкости" },
  { slug: "operation", name: "Операция «Дать на клык»" },
  { slug: "official", name: "Обычные кейсы" },
];
// Блок «Шелупонь» создаётся отдельно — lib/junk-cases.ts

const CASES: {
  section: string;
  name: string;
  slug: string;
  price: number;
  description: string;
  items: Seed[];
}[] = [
  {
    name: "Первый шаг",
    slug: "first-step",
    section: "operation",
    price: 49,
    description: "Дешёвый вход. В основном ширпотреб, но шанс есть.",
    items: [
      ["P250 | Sand Dune", "COMMON", 4],
      ["MAG-7 | Storm", "COMMON", 5],
      ["Nova | Predator", "COMMON", 6],
      ["SG 553 | Waves Perforated", "COMMON", 5],
      ["Glock-18 | Night", "UNCOMMON", 18],
      ["MP7 | Armor Core", "UNCOMMON", 15],
      ["Five-SeveN | Forest Night", "UNCOMMON", 14],
      ["USP-S | Torque", "RARE", 45],
      ["M4A4 | Evil Daimyo", "RARE", 70],
      ["P90 | Asiimov", "MYTHICAL", 260],
      ["AK-47 | Slate", "MYTHICAL", 290],
      ["AWP | Atheris", "LEGENDARY", 380],
    ],
  },
  {
    name: "Калашников",
    slug: "kalashnikov",
    section: "silchenko",
    price: 299,
    description: "Только AK-47. От пыли до Fire Serpent.",
    items: [
      ["AK-47 | Safari Mesh", "COMMON", 25],
      ["AK-47 | Elite Build", "UNCOMMON", 60],
      ["AK-47 | Uncharted", "UNCOMMON", 45],
      ["AK-47 | Ice Coaled", "RARE", 210],
      ["AK-47 | Slate", "RARE", 290],
      ["AK-47 | Phantom Disruptor", "RARE", 180],
      ["AK-47 | Redline", "LEGENDARY", 1650],
      ["AK-47 | Neon Rider", "LEGENDARY", 2400],
      ["AK-47 | Bloodsport", "ANCIENT", 4200],
      ["AK-47 | Asiimov", "ANCIENT", 3900],
      ["AK-47 | Vulcan", "ANCIENT", 9500],
      ["AK-47 | Fire Serpent", "ANCIENT", 52000],
    ],
  },
  {
    name: "Снайпер",
    slug: "sniper",
    section: "rare",
    price: 499,
    description: "AWP и SSG 08. Медленно, но метко.",
    items: [
      ["SSG 08 | Abyss", "UNCOMMON", 40],
      ["SSG 08 | Acid Fade", "RARE", 95],
      ["AWP | Pit Viper", "UNCOMMON", 60],
      ["AWP | Capillary", "RARE", 120],
      ["AWP | Atheris", "MYTHICAL", 380],
      ["AWP | Fever Dream", "MYTHICAL", 620],
      ["SSG 08 | Dragonfire", "LEGENDARY", 1900],
      ["AWP | Hyper Beast", "ANCIENT", 2300],
      ["AWP | Neo-Noir", "ANCIENT", 2600],
      ["AWP | Asiimov", "ANCIENT", 6800],
      ["AWP | Lightning Strike", "ANCIENT", 11000],
      ["AWP | Dragon Lore", "ANCIENT", 650000],
    ],
  },
  {
    name: "Пистолетный раунд",
    slug: "pistol-round",
    section: "author",
    price: 149,
    description: "Глоки, юспы, диглы. Первый раунд решает.",
    items: [
      ["Glock-18 | Sand Dune", "COMMON", 4],
      ["P2000 | Granite Marbleized", "COMMON", 6],
      ["Tec-9 | Isaac", "UNCOMMON", 20],
      ["CZ75-Auto | Victoria", "RARE", 140],
      ["P250 | Asiimov", "RARE", 160],
      ["Glock-18 | Water Elemental", "MYTHICAL", 340],
      ["USP-S | Cortex", "MYTHICAL", 290],
      ["Desert Eagle | Code Red", "LEGENDARY", 1450],
      ["USP-S | Kill Confirmed", "ANCIENT", 3900],
      ["Glock-18 | Fade", "ANCIENT", 95000],
      ["Desert Eagle | Blaze", "LEGENDARY", 48000],
    ],
  },
  {
    name: "Ва-банк",
    slug: "all-in",
    section: "silchenko",
    price: 1499,
    description: "Дорогой кейс для тех, кому не жалко.",
    items: [
      ["M4A1-S | Nightmare", "MYTHICAL", 420],
      ["M4A4 | Desolate Space", "MYTHICAL", 560],
      ["AK-47 | Redline", "LEGENDARY", 1650],
      ["M4A1-S | Hyper Beast", "ANCIENT", 1900],
      ["M4A4 | Neo-Noir", "ANCIENT", 2100],
      ["AK-47 | Neon Rider", "LEGENDARY", 2400],
      ["AWP | Asiimov", "ANCIENT", 6800],
      ["M4A4 | Howl", "ANCIENT", 420000],
      ["AK-47 | Fire Serpent", "ANCIENT", 52000],
      ["AWP | Lightning Strike", "ANCIENT", 11000],
    ],
  },
];

function chances(items: Seed[]) {
  const total = items.reduce((s, [, r]) => s + (WEIGHT[r] ?? 1), 0);
  const raw = items.map(([, r]) => Math.round(((WEIGHT[r] ?? 1) / total) * 100 * 100) / 100);
  // добиваем погрешность округления в первый (самый частый) предмет
  const diff = Math.round((100 - raw.reduce((a, b) => a + b, 0)) * 100) / 100;
  raw[0] = Math.round((raw[0] + diff) * 100) / 100;
  return raw;
}

async function main() {
  // 1. Настройки
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.siteSetting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  // 2. Каталог всех скинов и цены Steam (нужен интернет)
  try {
    await importCatalog(prisma);
    await updateAllPrices(prisma);
  } catch (e) {
    console.warn("! Каталог или цены не загрузились:", (e as Error).message);
  }

  // 3. Блоки
  const sectionIds: Record<string, string> = {};
  for (const [i, sec] of SECTIONS.entries()) {
    const row = await prisma.caseSection.upsert({
      where: { slug: sec.slug },
      update: {},
      create: { ...sec, sortOrder: i },
    });
    sectionIds[sec.slug] = row.id;
  }

  // 4. Кейсы-пустышки для своих блоков
  const itemIds = new Map<string, string>();
  for (const [ci, c] of CASES.entries()) {
    for (const [name, rarity, price] of c.items) {
      if (itemIds.has(name)) continue;
      const cat = await findDefault(prisma, name);
      const data = {
        name,
        rarity: cat?.rarity ?? rarity,
        price,
        image: cat?.image ?? null,
        wear: cat?.wear ?? "Field-Tested",
        marketHashName: cat?.marketHashName ?? null,
      };
      const existing = await prisma.item.findFirst({
        where: cat ? { marketHashName: cat.marketHashName } : { name },
      });
      const item = existing
        ? await prisma.item.update({ where: { id: existing.id }, data })
        : await prisma.item.create({ data });
      itemIds.set(name, item.id);
    }
    const lastItem = await prisma.item.findUnique({ where: { id: itemIds.get(c.items[c.items.length - 1][0])! } });
    const kase = await prisma.case.upsert({
      where: { slug: c.slug },
      update: { sectionId: sectionIds[c.section] },
      create: {
        name: c.name,
        slug: c.slug,
        price: c.price,
        description: c.description,
        sortOrder: ci,
        image: lastItem?.image ?? null,
        sectionId: sectionIds[c.section],
      },
    });
    const ch = chances(c.items);
    for (let i = 0; i < c.items.length; i++) {
      const itemId = itemIds.get(c.items[i][0])!;
      await prisma.caseItem.upsert({
        where: { caseId_itemId: { caseId: kase.id, itemId } },
        update: {},
        create: { caseId: kase.id, itemId, dropChance: ch[i] },
      });
    }
  }
  console.log(`Свои кейсы: ${CASES.length}`);

  // 5. Все обычные кейсы из игры
  try {
    await importOfficialCases(prisma, sectionIds.official);
  } catch (e) {
    console.warn("! Обычные кейсы не загрузились:", (e as Error).message);
  }

  // 6. Блок «Шелупонь»: наклейки, значки, нашивки
  try {
    await importJunkCases(prisma);
  } catch (e) {
    console.warn("! Блок «Шелупонь» не создан:", (e as Error).message);
  }

  // 7. Тестовый админ (настоящим админом станет первый, кто войдёт через Steam)
  await prisma.user.upsert({
    where: { steamId: "76561198000000000" },
    update: {},
    create: { steamId: "76561198000000000", username: "Тестовый админ", balance: 999999, role: "ADMIN" },
  });
  console.log("Готово.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

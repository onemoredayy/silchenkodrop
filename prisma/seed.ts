import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// steamId админа (потом замени на свой SteamID64)
const ADMIN_STEAM_ID = "76561198000000000";
const MARGIN = 1.15; // наценка на кейс
const SELL_COMMISSION = 0.05; // комиссия при продаже скина

const R = {
  C: "COMMON",
  U: "UNCOMMON",
  R: "RARE",
  M: "MYTHICAL",
  L: "LEGENDARY",
  A: "ANCIENT",
} as const;
type Code = keyof typeof R;

// [название, редкость, цена в ₽, износ, StatTrak]
type Row = [string, Code, number, string, boolean?];

// Базовые веса редкости. Внутри кейса нормализуются до суммы 100%
const WEIGHT: Record<Code, number> = { C: 40, U: 25, R: 18, M: 10, L: 5, A: 2 };

const CASES: { name: string; slug: string; description: string; items: Row[] }[] = [
  {
    name: "Стартовый кейс",
    slug: "starter",
    description: "Недорогие скины для разгона",
    items: [
      ["P250 | Sand Dune", "C", 6, "Field-Tested"],
      ["Nova | Predator", "C", 8, "Field-Tested"],
      ["MP9 | Storm", "C", 10, "Field-Tested"],
      ["Glock-18 | Candy Apple", "U", 25, "Factory New"],
      ["MAC-10 | Heat", "U", 30, "Field-Tested"],
      ["UMP-45 | Carbon Fiber", "U", 22, "Factory New"],
      ["FAMAS | Djinn", "R", 90, "Minimal Wear"],
      ["Desert Eagle | Oxide Blaze", "R", 140, "Factory New"],
      ["AK-47 | Redline", "M", 900, "Field-Tested"],
      ["AWP | Atheris", "M", 450, "Minimal Wear"],
      ["M4A1-S | Cyrex", "L", 2500, "Factory New"],
      ["AWP | Asiimov", "A", 6000, "Field-Tested"],
    ],
  },
  {
    name: "Снайперский кейс",
    slug: "sniper",
    description: "Винтовки для дальних дистанций",
    items: [
      ["SSG 08 | Blue Spruce", "C", 7, "Field-Tested"],
      ["SCAR-20 | Contractor", "C", 9, "Field-Tested"],
      ["G3SG1 | Desert Storm", "C", 12, "Field-Tested"],
      ["SSG 08 | Slashed", "U", 28, "Factory New"],
      ["SCAR-20 | Cyrex", "U", 35, "Minimal Wear"],
      ["G3SG1 | Demeter", "U", 32, "Factory New"],
      ["AWP | Worm God", "R", 110, "Factory New"],
      ["AWP | Pit Viper", "R", 150, "Minimal Wear"],
      ["AWP | Redline", "M", 700, "Field-Tested"],
      ["AWP | Hyper Beast", "M", 1300, "Minimal Wear", true],
      ["AWP | Neo-Noir", "L", 3200, "Factory New"],
      ["AWP | Dragon Lore", "A", 45000, "Field-Tested"],
    ],
  },
  {
    name: "Штурмовые винтовки",
    slug: "rifles",
    description: "AK-47, M4 и компания",
    items: [
      ["Galil AR | Sage Spirit", "C", 8, "Field-Tested"],
      ["FAMAS | Sergeant", "C", 10, "Field-Tested"],
      ["SG 553 | Damascus Steel", "C", 12, "Minimal Wear"],
      ["M4A4 | Desert-Strike", "U", 35, "Field-Tested"],
      ["AK-47 | Blue Laminate", "U", 40, "Field-Tested"],
      ["AUG | Bengal Tiger", "U", 30, "Minimal Wear"],
      ["M4A4 | Buzz Kill", "R", 220, "Factory New"],
      ["AK-47 | Point Disarray", "R", 160, "Minimal Wear"],
      ["AK-47 | Asiimov", "M", 1100, "Field-Tested", true],
      ["M4A4 | Neo-Noir", "M", 700, "Minimal Wear"],
      ["AK-47 | Vulcan", "L", 2800, "Factory New"],
      ["M4A4 | Howl", "A", 20000, "Minimal Wear"],
    ],
  },
  {
    name: "Пистолетный кейс",
    slug: "pistols",
    description: "Всё для любителей пистолетов",
    items: [
      ["Tec-9 | Sandstorm", "C", 5, "Field-Tested"],
      ["Five-SeveN | Forest Night", "C", 6, "Field-Tested"],
      ["P2000 | Granite Marbleized", "C", 9, "Factory New"],
      ["USP-S | Guardian", "U", 45, "Minimal Wear"],
      ["Glock-18 | Steel Disruption", "U", 30, "Factory New"],
      ["CZ75-Auto | Tigris", "U", 28, "Factory New"],
      ["Desert Eagle | Code Red", "R", 200, "Minimal Wear"],
      ["P250 | Asiimov", "R", 150, "Field-Tested"],
      ["USP-S | Kill Confirmed", "M", 1600, "Minimal Wear", true],
      ["Desert Eagle | Printstream", "M", 900, "Factory New"],
      ["Glock-18 | Fade", "L", 3500, "Factory New"],
      ["Desert Eagle | Blaze", "A", 15000, "Factory New"],
    ],
  },
  {
    name: "Ножи и перчатки",
    slug: "knives",
    description: "Премиум-кейс с ножами",
    items: [
      ["Navaja Knife | Safari Mesh", "C", 600, "Field-Tested"],
      ["Stiletto Knife | Boreal Forest", "C", 800, "Field-Tested"],
      ["Ursus Knife | Scorched", "C", 900, "Field-Tested"],
      ["Bayonet | Forest DDPAT", "U", 1500, "Field-Tested"],
      ["Flip Knife | Urban Masked", "U", 1400, "Field-Tested"],
      ["Gut Knife | Night", "U", 1300, "Field-Tested"],
      ["Falchion Knife | Slaughter", "R", 2500, "Factory New"],
      ["Huntsman Knife | Fade", "R", 4000, "Factory New"],
      ["M9 Bayonet | Tiger Tooth", "M", 9000, "Factory New"],
      ["Butterfly Knife | Doppler", "M", 12000, "Factory New"],
      ["Karambit | Fade", "L", 30000, "Factory New"],
      ["Sport Gloves | Pandora's Box", "A", 60000, "Field-Tested"],
    ],
  },
];

const round3 = (n: number) => Math.round(n * 1000) / 1000;

// Шансы: вес редкости делится поровну между предметами этой редкости,
// сумма по кейсу всегда ровно 100
function chances(rows: Row[]): number[] {
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r[1]] = (counts[r[1]] ?? 0) + 1;
  const total = Object.keys(counts).reduce((s, k) => s + WEIGHT[k as Code], 0);
  const res = rows.map((r) => round3(((WEIGHT[r[1]] / total) * 100) / counts[r[1]]));
  const diff = round3(100 - res.reduce((a, b) => a + b, 0));
  res[res.length - 1] = round3(res[res.length - 1] + diff);
  return res;
}

async function main() {
  // Чистим каталог (пользователи остаются)
  await prisma.opening.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.caseItem.deleteMany();
  await prisma.item.deleteMany();
  await prisma.case.deleteMany();

  await prisma.user.upsert({
    where: { steamId: ADMIN_STEAM_ID },
    update: { role: "ADMIN", balance: 999999 },
    create: { steamId: ADMIN_STEAM_ID, username: "Admin", role: "ADMIN", balance: 999999 },
  });

  await prisma.siteSetting.upsert({
    where: { key: "margin" },
    update: { value: String(MARGIN) },
    create: { key: "margin", value: String(MARGIN) },
  });
  await prisma.siteSetting.upsert({
    where: { key: "sellCommission" },
    update: { value: String(SELL_COMMISSION) },
    create: { key: "sellCommission", value: String(SELL_COMMISSION) },
  });

  for (const c of CASES) {
    const ch = chances(c.items);
    const caseRow = await prisma.case.create({
      data: { name: c.name, slug: c.slug, description: c.description, image: "", price: 0 },
    });

    let ev = 0;
    for (let i = 0; i < c.items.length; i++) {
      const [name, code, price, wear, statTrak] = c.items[i];
      const item = await prisma.item.create({
        data: { name, rarity: R[code], price, wear, statTrak: !!statTrak, image: "" },
      });
      await prisma.caseItem.create({
        data: { caseId: caseRow.id, itemId: item.id, dropChance: ch[i] },
      });
      ev += (price * ch[i]) / 100;
    }

    // Цена кейса = сумма(price * dropChance / 100) * margin
    const casePrice = Math.round(ev * MARGIN);
    await prisma.case.update({ where: { id: caseRow.id }, data: { price: casePrice } });

    const sum = round3(ch.reduce((a, b) => a + b, 0));
    console.log(`${c.name}: цена ${casePrice} ₽, сумма шансов ${sum}%`);
  }

  console.log("Seed готов");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

// Загрузка полного списка скинов CS2 из открытого репозитория ByMykel/CSGO-API.
// Используется в prisma/seed.ts и scripts/import-catalog.ts (без зависимостей от Next).
import type { PrismaClient } from "@prisma/client";
import { mapCatalogRarity } from "./rarity";

export const CATALOG_URL =
  "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json";

type RawSkin = {
  name?: string;
  weapon?: { name?: string } | null;
  rarity?: { id?: string; color?: string } | null;
  wears?: { name?: string }[] | null;
  image?: string | null;
};

// Предпочитаем «После полевых» — самое ходовое качество на рынке
const WEAR_ORDER = ["Field-Tested", "Minimal Wear", "Well-Worn", "Factory New", "Battle-Scarred"];

function pickWear(wears: RawSkin["wears"]) {
  const names = (wears ?? []).map((w) => w?.name).filter(Boolean) as string[];
  if (names.length === 0) return null;
  for (const w of WEAR_ORDER) if (names.includes(w)) return w;
  return names[0];
}

export async function importCatalog(prisma: PrismaClient, log = console.log) {
  log(`Скачиваю каталог: ${CATALOG_URL}`);
  const res = await fetch(CATALOG_URL);
  if (!res.ok) throw new Error(`Каталог не скачался: HTTP ${res.status}`);
  const data = (await res.json()) as RawSkin[];
  if (!Array.isArray(data)) throw new Error("Неожиданный формат каталога");

  let added = 0;
  let updated = 0;
  for (const s of data) {
    if (!s?.name) continue;
    const wear = pickWear(s.wears);
    const marketHashName = wear ? `${s.name} (${wear})` : s.name;
    const row = {
      name: s.name,
      weapon: s.weapon?.name ?? s.name.split(" | ")[0].replace(/^★\s*/, ""),
      rarity: mapCatalogRarity(s.rarity?.id),
      rarityColor: s.rarity?.color ?? null,
      wear,
      image: s.image ?? null,
    };
    const existing = await prisma.skinCatalog.findUnique({ where: { marketHashName } });
    if (existing) {
      await prisma.skinCatalog.update({ where: { marketHashName }, data: row });
      updated++;
    } else {
      await prisma.skinCatalog.create({ data: { marketHashName, ...row } });
      added++;
    }
  }
  log(`Каталог готов: добавлено ${added}, обновлено ${updated}`);
  return { added, updated };
}

// Разбор цены Steam: "1 234,56 руб." / "$12.34" → число
export function parseSteamPrice(s: string | undefined | null) {
  if (!s) return null;
  let t = s.replace(/[^\d.,]/g, "");
  if (t.includes(",") && t.includes(".")) {
    // "1,234.56" → убираем разделитель тысяч
    t = t.lastIndexOf(",") > t.lastIndexOf(".") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else {
    t = t.replace(",", ".");
  }
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

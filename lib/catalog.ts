// Каталог всех скинов CS2 (каждое качество и StatTrak отдельно) из ByMykel/CSGO-API.
// Без зависимостей от Next — используется в seed, скриптах и автообновлении.
import type { PrismaClient } from "@prisma/client";
import { mapCatalogRarity } from "./rarity";

const API = "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en";
export const SKINS_URL = `${API}/skins_not_grouped.json`;
export const CRATES_URL = `${API}/crates.json`;

type RawSkin = {
  name?: string;
  market_hash_name?: string;
  weapon?: { name?: string } | null;
  category?: { name?: string } | null;
  rarity?: { id?: string; color?: string } | null;
  wear?: { name?: string } | null;
  stattrak?: boolean;
  souvenir?: boolean;
  image?: string | null;
};

// Самое ходовое качество — оно станет «основным» вариантом скина
const WEAR_ORDER = ["Field-Tested", "Minimal Wear", "Well-Worn", "Factory New", "Battle-Scarred"];

export function baseNameOf(marketHashName: string) {
  return marketHashName
    .replace("StatTrak™ ", "")
    .replace(/\s\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/, "")
    .trim();
}

export async function importCatalog(prisma: PrismaClient, log = console.log) {
  log("Каталог: скачиваю список скинов…");
  const res = await fetch(SKINS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Каталог не скачался: HTTP ${res.status}`);
  const data = (await res.json()) as RawSkin[];

  // Уникальные предметы рынка (Doppler-фазы делят одно имя), без сувениров
  const rows = new Map<string, ReturnType<typeof toRow>>();
  for (const s of data) {
    if (!s?.market_hash_name || s.souvenir) continue;
    if (!rows.has(s.market_hash_name)) rows.set(s.market_hash_name, toRow(s));
  }

  // Основной вариант: без StatTrak, по порядку качеств
  const byBase = new Map<string, ReturnType<typeof toRow>[]>();
  for (const r of rows.values()) {
    if (r.statTrak) continue;
    const list = byBase.get(r.baseName) ?? [];
    list.push(r);
    byBase.set(r.baseName, list);
  }
  for (const list of byBase.values()) {
    list.sort((a, b) => rank(a.wear) - rank(b.wear));
    list[0].isDefault = true;
  }

  const existing = new Set(
    (await prisma.skinCatalog.findMany({ select: { marketHashName: true } })).map((r) => r.marketHashName),
  );
  const fresh = [...rows.values()].filter((r) => !existing.has(r.marketHashName));
  const old = [...rows.values()].filter((r) => existing.has(r.marketHashName));

  for (let i = 0; i < fresh.length; i += 500) {
    await prisma.skinCatalog.createMany({ data: fresh.slice(i, i + 500) });
  }
  for (let i = 0; i < old.length; i += 300) {
    await prisma.$transaction(
      old.slice(i, i + 300).map(({ marketHashName, ...data }) =>
        prisma.skinCatalog.update({ where: { marketHashName }, data }),
      ),
    );
  }
  log(`Каталог: ${rows.size} предметов (новых ${fresh.length})`);
  return rows.size;
}

function rank(w: string | null) {
  const i = w ? WEAR_ORDER.indexOf(w) : -1;
  return i === -1 ? 99 : i;
}

function toRow(s: RawSkin) {
  const mhn = s.market_hash_name!;
  const baseName = baseNameOf(mhn);
  return {
    marketHashName: mhn,
    baseName,
    name: baseName,
    weapon: s.weapon?.name ?? baseName.split(" | ")[0].replace(/^★\s*/, ""),
    category: s.category?.name ?? null,
    rarity: mapCatalogRarity(s.rarity?.id, mhn),
    rarityColor: s.rarity?.color ?? null,
    wear: s.wear?.name ?? null,
    statTrak: !!s.stattrak,
    isDefault: false,
    image: s.image ?? null,
  };
}

// Основной вариант скина по базовому имени («AK-47 | Redline»)
export function findDefault(prisma: PrismaClient, baseName: string) {
  return prisma.skinCatalog.findFirst({
    where: { baseName, statTrak: false },
    orderBy: [{ isDefault: "desc" }],
  });
}

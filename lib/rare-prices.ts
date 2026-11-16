// Предметы, у которых нет нормальной цены в Steam: они дороже потолка Steam Market ($2000)
// и продаются только на сторонних площадках / из рук в руки. Цена — оценка сообщества в долларах
// (сторонние площадки: csfloat, buff, skinport и т.п., ноябрь 2026). Переводится в рубли по тому же курсу.
// Эти цены всегда перекрывают Steam: данные Steam по таким предметам либо пустые, либо мусорные.
// Поправить цену = поменять число здесь и дождаться обновления цен (или нажать «Обновить цены» в админке).
import type { PrismaClient } from "@prisma/client";

export const RARE_USD: Record<string, number> = {
  // Наклейки Katowice 2014
  "Sticker | Titan (Holo) | Katowice 2014": 70000,
  "Sticker | iBUYPOWER (Holo) | Katowice 2014": 60000,
  "Sticker | Reason Gaming (Holo) | Katowice 2014": 40000,
  "Sticker | LGB eSports (Holo) | Katowice 2014": 25000,
  "Sticker | Dignitas (Holo) | Katowice 2014": 15000,
  "Sticker | Vox Eminor (Holo) | Katowice 2014": 12000,
  "Sticker | Team LDLC.com (Holo) | Katowice 2014": 10000,
  "Sticker | HellRaisers (Holo) | Katowice 2014": 8000,
  "Sticker | Titan | Katowice 2014": 3200,
  "Sticker | iBUYPOWER | Katowice 2014": 2800,
  "Sticker | Crown (Foil)": 8000,

  // Скины
  "Souvenir AWP | Dragon Lore (Factory New)": 250000,
  "Souvenir AWP | Dragon Lore (Minimal Wear)": 60000,
  "Souvenir AWP | Dragon Lore (Field-Tested)": 25000,
  "AWP | Dragon Lore (Factory New)": 12000,
  "AWP | Gungnir (Factory New)": 15000,
  "AK-47 | Wild Lotus (Factory New)": 15000,
  "StatTrak™ M4A4 | Howl (Factory New)": 30000,
  "M4A4 | Howl (Factory New)": 8000,
};

export const isCommunityPriced = (marketHashName: string) => marketHashName in RARE_USD;

// Сувенирных скинов в каталоге нет (импорт их пропускает) — заводим нужные,
// копируя картинку и редкость с обычной версии скина.
export async function ensureRareRows(prisma: PrismaClient) {
  const names = Object.keys(RARE_USD);
  const have = new Set(
    (await prisma.skinCatalog.findMany({ where: { marketHashName: { in: names } }, select: { marketHashName: true } })).map(
      (r) => r.marketHashName,
    ),
  );
  for (const mhn of names) {
    if (have.has(mhn) || !mhn.startsWith("Souvenir ")) continue;
    const base = await prisma.skinCatalog.findUnique({ where: { marketHashName: mhn.replace(/^Souvenir /, "") } });
    if (!base) continue;
    const { id: _id, createdAt: _c, price: _p, lastPriceUpdate: _l, ...rest } = base;
    await prisma.skinCatalog.create({
      data: { ...rest, marketHashName: mhn, baseName: `Souvenir ${base.baseName}`, name: `Souvenir ${base.name}`, isDefault: false },
    });
  }
}

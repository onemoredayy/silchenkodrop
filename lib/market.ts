import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Работает и с обычным клиентом, и внутри prisma.$transaction
type Db = PrismaClient | Prisma.TransactionClient;

export const DEFAULT_MARGIN = 1.15; // наценка на кейс
export const DEFAULT_SELL_COMMISSION = 0.05; // комиссия при продаже (5%)

export type SiteSettings = {
  margin: number;
  sellCommission: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

// Читает число из SiteSetting, при ошибке или отсутствии берёт значение по умолчанию
function parseNum(value: string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return fallback;
  return n;
}

export async function getSettings(db: Db = prisma): Promise<SiteSettings> {
  const rows = await db.siteSetting.findMany({
    where: { key: { in: ["margin", "sellCommission"] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    margin: parseNum(map.margin, DEFAULT_MARGIN, 0.1, 10),
    sellCommission: parseNum(map.sellCommission, DEFAULT_SELL_COMMISSION, 0, 0.9),
  };
}

// Цена кейса = сумма(price * dropChance / 100) * margin
export function calcCasePrice(
  entries: { dropChance: number; item: { price: number } }[],
  margin: number
): number {
  const ev = entries.reduce((sum, e) => sum + (e.item.price * e.dropChance) / 100, 0);
  return Math.max(1, Math.round(ev * margin));
}

// Сколько игрок получит на баланс при продаже скина
export function calcSellPrice(itemPrice: number, commission: number): number {
  return round2(itemPrice * (1 - commission));
}

// Пересчитывает и сохраняет цену одного кейса
// (вызывать после изменения шансов, предметов или маржи)
export async function recalcCasePrice(caseId: string, db: Db = prisma): Promise<number> {
  const [entries, settings] = await Promise.all([
    db.caseItem.findMany({ where: { caseId }, include: { item: true } }),
    getSettings(db),
  ]);
  const price = calcCasePrice(entries, settings.margin);
  await db.case.update({ where: { id: caseId }, data: { price } });
  return price;
}

// Пересчитывает цены всех кейсов (после смены маржи в настройках)
export async function recalcAllCasePrices(db: Db = prisma): Promise<void> {
  const cases = await db.case.findMany({ select: { id: true } });
  for (const c of cases) {
    await recalcCasePrice(c.id, db);
  }
}

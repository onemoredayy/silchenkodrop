// Цены на ВСЕ предметы Steam одним запросом: prices.csgotrader.app (база расширения CSGO Trader).
// Цены там в долларах, переводим в рубли по курсу ЦБ (или по курсу из настроек админки).
import type { PrismaClient } from "@prisma/client";

export const PRICES_URL = "https://prices.csgotrader.app/latest/steam.json";
const CBR_URL = "https://www.cbr-xml-daily.ru/daily_json.js";

type PriceRow = { last_24h?: number | null; last_7d?: number | null; last_30d?: number | null; last_90d?: number | null };

async function setting(prisma: PrismaClient, key: string) {
  return (await prisma.siteSetting.findUnique({ where: { key } }))?.value;
}

async function usdRub(prisma: PrismaClient) {
  const manual = Number(await setting(prisma, "usdRub"));
  if (manual > 0) return manual;
  try {
    const j = (await (await fetch(CBR_URL, { cache: "no-store" })).json()) as { Valute?: { USD?: { Value?: number } } };
    const v = j.Valute?.USD?.Value;
    if (v && v > 0) {
      await prisma.siteSetting.upsert({
        where: { key: "usdRubAuto" },
        update: { value: String(v) },
        create: { key: "usdRubAuto", value: String(v) },
      });
      return v;
    }
  } catch {}
  return Number(await setting(prisma, "usdRubAuto")) || 90;
}

export async function updateAllPrices(prisma: PrismaClient, log = console.log) {
  log("Цены: скачиваю базу Steam…");
  const res = await fetch(PRICES_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Цены не скачались: HTTP ${res.status}`);
  const data = (await res.json()) as Record<string, PriceRow>;
  const rate = await usdRub(prisma);

  const rows = await prisma.skinCatalog.findMany({ select: { id: true, marketHashName: true, price: true } });
  const now = new Date();
  const updates: { id: string; price: number }[] = [];
  for (const r of rows) {
    const p = data[r.marketHashName];
    // берём недельную цену: она устойчивее суточной; если её нет — что есть
    const usd = p?.last_7d ?? p?.last_24h ?? p?.last_30d ?? p?.last_90d;
    if (usd == null || usd <= 0) continue;
    const rub = Math.round(usd * rate * 100) / 100;
    if (rub !== r.price) updates.push({ id: r.id, price: rub });
  }
  for (let i = 0; i < updates.length; i += 500) {
    await prisma.$transaction(
      updates.slice(i, i + 500).map((u) =>
        prisma.skinCatalog.update({ where: { id: u.id }, data: { price: u.price, lastPriceUpdate: now } }),
      ),
    );
  }
  await prisma.siteSetting.upsert({
    where: { key: "pricesUpdatedAt" },
    update: { value: now.toISOString() },
    create: { key: "pricesUpdatedAt", value: now.toISOString() },
  });
  log(`Цены: обновлено ${updates.length} из ${rows.length}, курс $1 = ${rate} ₽`);
  return { updated: updates.length, total: rows.length, rate };
}

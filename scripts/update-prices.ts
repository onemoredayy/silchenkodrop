// Обновление цен со Steam Market небольшими порциями.
// Steam банит IP за частые запросы, поэтому: ~20 скинов за запуск, пауза 3.5 с между запросами.
// На VPS повесь на cron каждые 15 минут — весь каталог обновится примерно за 2–3 дня.
//
//   BATCH=20 DELAY=3500 npm run prices:update
//
// Цены в рублях (currency=5). Из датацентров Azure/Codespaces Steam отвечает 429 — это нормально.
import { PrismaClient } from "@prisma/client";
import { parseSteamPrice } from "../lib/catalog";

const prisma = new PrismaClient();
const BATCH = Number(process.env.BATCH || 20);
const DELAY = Number(process.env.DELAY || 3500);
const CURRENCY = Number(process.env.CURRENCY || 5);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Сначала — предметы из кейсов, потом — давно не обновлявшиеся
  const inCases = await prisma.skinCatalog.findMany({
    where: { items: { some: {} } },
    orderBy: { lastPriceUpdate: { sort: "asc", nulls: "first" } },
    take: BATCH,
  });
  const rest =
    inCases.length < BATCH
      ? await prisma.skinCatalog.findMany({
          where: { id: { notIn: inCases.map((r) => r.id) } },
          orderBy: { lastPriceUpdate: { sort: "asc", nulls: "first" } },
          take: BATCH - inCases.length,
        })
      : [];
  // предметы кейсов, обновлённые меньше 12 ч назад, не трогаем повторно
  const fresh = Date.now() - 12 * 3600 * 1000;
  const batch = [
    ...inCases.filter((r) => !r.lastPriceUpdate || r.lastPriceUpdate.getTime() < fresh),
    ...rest,
  ].slice(0, BATCH);

  let ok = 0;
  for (const row of batch) {
    const url =
      `https://steamcommunity.com/market/priceoverview/?appid=730&currency=${CURRENCY}` +
      `&market_hash_name=${encodeURIComponent(row.marketHashName)}`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 silchenkodrop" } });
    if (res.status === 429) {
      console.warn("Steam: 429 (слишком часто). Останавливаюсь до следующего запуска.");
      break;
    }
    let price: number | null = null;
    if (res.ok) {
      const j = (await res.json()) as { success?: boolean; lowest_price?: string; median_price?: string };
      if (j.success) price = parseSteamPrice(j.lowest_price) ?? parseSteamPrice(j.median_price);
    }
    await prisma.skinCatalog.update({
      where: { id: row.id },
      // даже без цены ставим дату, чтобы не застревать на одном скине
      data: { lastPriceUpdate: new Date(), ...(price != null ? { price } : {}) },
    });
    if (price != null) ok++;
    console.log(`${row.marketHashName}: ${price ?? "нет на рынке"}`);
    await sleep(DELAY);
  }
  console.log(`Обновлено цен: ${ok} из ${batch.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

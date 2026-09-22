import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// Сколько скинов обновлять за один запуск скрипта
const BATCH_SIZE = 40

// Пауза между запросами к Steam (мс) — чтобы не словить rate-limit
const DELAY_MS = 3000

// appid для CS2 в Steam Community Market
const APP_ID = 730

interface PriceOverviewResponse {
  success: boolean
  lowest_price?: string
  median_price?: string
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parsePrice(raw?: string): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/[^\d.,]/g, "").replace(",", ".")
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

async function fetchPrice(marketHashName: string): Promise<number | null> {
  const url = `https://steamcommunity.com/market/priceoverview/?appid=${APP_ID}&currency=5&market_hash_name=${encodeURIComponent(
    marketHashName
  )}`

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
    })

    const text = await res.text()
    console.log(
      `  [debug] HTTP ${res.status} для "${marketHashName}": ${text.slice(0, 150)}`
    )

    if (!res.ok) return null

    const data: PriceOverviewResponse = JSON.parse(text)
    if (!data.success) return null
    return parsePrice(data.lowest_price) ?? parsePrice(data.median_price)
  } catch (err) {
    console.log(`  Ошибка запроса для "${marketHashName}":`, err)
    return null
  }
}

async function main() {
  console.log("Ищу следующую пачку скинов для обновления цен...")

  const batch = await prisma.skinCatalog.findMany({
    orderBy: [{ lastPriceUpdate: { sort: "asc", nulls: "first" } }],
    take: BATCH_SIZE,
  })

  console.log(`Взято в работу: ${batch.length} скинов`)

  let updated = 0
  let failed = 0

  for (const skin of batch) {
    const price = await fetchPrice(skin.marketHashName)

    if (price !== null) {
      await prisma.skinCatalog.update({
        where: { id: skin.id },
        data: { price, lastPriceUpdate: new Date() },
      })
      updated++
      console.log(`  ✓ ${skin.marketHashName}: ${price}`)
    } else {
      await prisma.skinCatalog.update({
        where: { id: skin.id },
        data: { lastPriceUpdate: new Date() },
      })
      failed++
      console.log(`  ✗ ${skin.marketHashName}: цена не найдена`)
    }

    await sleep(DELAY_MS)
  }

  console.log(`Готово. Обновлено: ${updated}, без цены: ${failed}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})

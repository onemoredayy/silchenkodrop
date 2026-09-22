import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const CATALOG_URL =
  "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json"

interface CsgoApiSkin {
  id: string
  name: string
  description?: string | null
  weapon?: { id: string; name: string } | null
  category?: { id: string; name: string } | null
  pattern?: { id: string; name: string } | null
  min_float?: number | null
  max_float?: number | null
  rarity?: { id: string; name: string; color?: string } | null
  stattrak?: boolean
  souvenir?: boolean
  image?: string | null
}

function buildMarketHashName(skin: CsgoApiSkin, statTrak: boolean): string | null {
  if (!skin.weapon?.name || !skin.pattern?.name) return null
  const prefix = statTrak ? "StatTrak\u2122 " : ""
  return `${prefix}${skin.weapon.name} | ${skin.pattern.name}`
}

async function main() {
  console.log("Загружаю список скинов из CSGO-API...")
  const res = await fetch(CATALOG_URL)
  if (!res.ok) {
    throw new Error(`Не удалось загрузить каталог: ${res.status}`)
  }
  const skins: CsgoApiSkin[] = await res.json()
  console.log(`Получено ${skins.length} записей`)

  let created = 0
  let updated = 0
  let skipped = 0

  for (const skin of skins) {
    // Пропускаем ножи/перчатки без weapon/pattern или явно неполные записи
    const marketHashName = buildMarketHashName(skin, false)
    if (!marketHashName) {
      skipped++
      continue
    }

    const data = {
      name: skin.name,
      weapon: skin.weapon?.name ?? null,
      rarity: skin.rarity?.name ?? null,
      wear: null,
      statTrak: false,
      image: skin.image ?? null,
    }

    const result = await prisma.skinCatalog.upsert({
      where: { marketHashName },
      create: { marketHashName, ...data },
      update: data,
    })

    if (result) {
      // upsert не говорит create/update напрямую, посчитаем примерно
      created++
    }
  }

  console.log(`Готово. Обработано: ${created}, пропущено (без названия): ${skipped}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})

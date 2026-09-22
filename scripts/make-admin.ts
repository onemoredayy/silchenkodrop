import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.updateMany({
    where: { username: { contains: "Лёха Навальный" } },
    data: { role: "ADMIN" },
  })

  console.log(`Обновлено пользователей: ${user.count}`)

  const all = await prisma.user.findMany({
    select: { username: true, role: true },
  })
  console.log(all)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})

// Обновить цены всех скинов вручную. Сайт и так делает это сам каждые 6 часов.
// Запуск: npm run prices:update
import { PrismaClient } from "@prisma/client";
import { updateAllPrices } from "../lib/prices";

const prisma = new PrismaClient();

updateAllPrices(prisma)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

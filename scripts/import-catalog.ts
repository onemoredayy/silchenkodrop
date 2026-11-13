// Обновить каталог скинов (новые скины из обновлений CS) и цены.
// Запуск: npm run catalog:import
import { PrismaClient } from "@prisma/client";
import { importCatalog } from "../lib/catalog";
import { updateAllPrices } from "../lib/prices";

const prisma = new PrismaClient();

importCatalog(prisma)
  .then(() => updateAllPrices(prisma))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

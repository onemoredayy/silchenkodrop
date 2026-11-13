// Полный каталог скинов CS2 → таблица SkinCatalog.
// Запуск: npm run catalog:import
import { PrismaClient } from "@prisma/client";
import { importCatalog } from "../lib/catalog";

const prisma = new PrismaClient();

importCatalog(prisma)
  .then(async () => {
    // заодно связываем предметы кейсов с каталогом (картинка + рыночная цена)
    const items = await prisma.item.findMany({ where: { marketHashName: null } });
    let linked = 0;
    for (const it of items) {
      const cat = await prisma.skinCatalog.findFirst({ where: { name: it.name } });
      if (!cat) continue;
      await prisma.item.update({
        where: { id: it.id },
        data: { marketHashName: cat.marketHashName, image: it.image ?? cat.image, wear: cat.wear },
      });
      linked++;
    }
    console.log(`Связано предметов с каталогом: ${linked}`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

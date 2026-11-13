import { prisma } from "@/lib/prisma";
import { itemPrice } from "@/lib/pricing";
import { rarityColor, RARITIES } from "@/lib/rarity";
import CaseCard from "@/components/CaseCard";
import DropTicker from "@/components/DropTicker";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [cases, recent, stats] = await Promise.all([
    prisma.case.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
      include: { items: { include: { item: true } } },
    }),
    prisma.opening.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { user: true, item: { include: { catalog: true } } },
    }),
    prisma.opening.aggregate({ _count: true }),
  ]);

  const drops = recent.map((o) => ({
    id: o.id,
    user: o.user.username,
    item: o.item.name,
    rarity: o.item.rarity,
    image: o.item.image,
    price: o.itemPrice || itemPrice(o.item),
  }));

  return (
    <div className="space-y-10">
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl leading-none sm:text-6xl">
              Сильченко<span className="text-stencil">Дроп</span>
            </h1>
            <p className="mt-3 max-w-xl text-dust">
              Кейсы CS2 для своих. Шансы честные и видны на каждом кейсе, выпадение считает сервер.
            </p>
          </div>
          <div className="text-right text-sm text-dust">
            Открыто кейсов: <span className="text-bone">{stats._count.toLocaleString("ru-RU")}</span>
          </div>
        </div>
        <DropTicker drops={drops} />
      </section>

      <section>
        <h2 className="h2 mb-4">Кейсы</h2>
        {cases.length === 0 ? (
          <div className="panel p-6 text-dust">Кейсов пока нет. Добавь их в админке.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cases.map((c) => {
              const present = new Set(c.items.map((r) => r.item.rarity));
              return (
                <CaseCard
                  key={c.id}
                  slug={c.slug}
                  name={c.name}
                  price={c.price}
                  image={c.image}
                  count={c.items.length}
                  topColors={RARITIES.filter((r) => present.has(r)).map(rarityColor)}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

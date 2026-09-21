import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import Roulette, { RouletteItem } from "@/components/Roulette";
import ItemCard from "@/components/ItemCard";

export const dynamic = "force-dynamic";

async function loadCase(slug: string) {
  const c = await prisma.case.findUnique({
    where: { slug },
    include: { items: { include: { item: true } } },
  });
  if (!c || !c.isActive) return null;

  const items: RouletteItem[] = c.items
    .map((ci) => ({
      name: ci.item.name,
      rarity: ci.item.rarity,
      price: ci.item.price,
      image: ci.item.image,
      wear: ci.item.wear,
      statTrak: ci.item.statTrak,
      dropChance: ci.dropChance,
    }))
    .sort((a, b) => b.price - a.price);

  return {
    id: c.id,
    name: c.name,
    description: c.description,
    price: c.price,
    items,
  };
}

function formatChance(n: number): string {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 3 });
}

export default async function CasePage({
  params,
}: {
  params: { slug: string };
}) {
  const [data, user] = await Promise.all([loadCase(params.slug), getCurrentUser()]);
  if (!data) notFound();

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Все кейсы
        </Link>
        <h1 className="mt-2 text-3xl font-black tracking-tight">{data.name}</h1>
        <p className="text-muted-foreground">{data.description}</p>
      </div>

      {data.items.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-muted-foreground">
          В этом кейсе пока нет предметов.
        </p>
      ) : (
        <Roulette
          caseId={data.id}
          price={data.price}
          items={data.items}
          loggedIn={!!user && !user.isBanned}
        />
      )}

      <section>
        <h2 className="mb-4 text-xl font-bold">Что внутри</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {data.items.map((it, i) => (
            <div key={i} className="space-y-1">
              <div className="h-44">
                <ItemCard item={it} />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Шанс: {formatChance(it.dropChance)}%
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

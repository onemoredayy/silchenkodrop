import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { itemPrice } from "@/lib/pricing";
import { RARITIES } from "@/lib/rarity";
import { money } from "@/lib/format";
import ItemCard from "@/components/ItemCard";
import CaseOpener from "@/components/CaseOpener";

export const dynamic = "force-dynamic";

export default async function CasePage({ params }: { params: { slug: string } }) {
  const kase = await prisma.case.findUnique({
    where: { slug: params.slug },
    include: { items: { include: { item: { include: { catalog: true } } } } },
  });
  if (!kase || !kase.isActive) notFound();

  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);

  const items = kase.items
    .map((r) => ({
      id: r.item.id,
      name: r.item.name,
      rarity: r.item.rarity,
      image: r.item.image,
      wear: r.item.wear,
      price: itemPrice(r.item),
      chance: r.dropChance,
    }))
    .sort((a, b) => RARITIES.indexOf(b.rarity as never) - RARITIES.indexOf(a.rarity as never) || b.price - a.price);

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="h1">{kase.name}</h1>
            {kase.description && <p className="mt-2 max-w-xl text-dust">{kase.description}</p>}
          </div>
          <div className="font-display text-2xl text-stencil">{money(kase.price)}</div>
        </div>
        <CaseOpener
          caseId={kase.id}
          price={kase.price}
          items={items}
          loggedIn={!!user}
          balance={user?.balance ?? 0}
          banned={!!user?.isBanned}
          sellCommission={settings.sellCommission}
        />
      </section>

      <section>
        <h2 className="h2 mb-4">Что внутри</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((it) => (
            <ItemCard key={it.id} {...it} />
          ))}
        </div>
      </section>
    </div>
  );
}

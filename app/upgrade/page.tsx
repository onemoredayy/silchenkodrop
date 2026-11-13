import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { itemPrice } from "@/lib/pricing";
import { ago, money } from "@/lib/format";
import Upgrader from "@/components/Upgrader";

export const dynamic = "force-dynamic";

export default async function UpgradePage() {
  const user = await requireUser();
  const [{ upgradeEdge, upgradeMaxChance }, inv, history] = await Promise.all([
    getSettings(),
    prisma.inventoryItem.findMany({
      where: { userId: user.id, isSold: false },
      orderBy: { acquiredAt: "desc" },
      include: { item: { include: { catalog: true } } },
      take: 300,
    }),
    prisma.upgrade.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { target: true },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="h1">Апгрейд</h1>
        <p className="mt-2 max-w-2xl text-dust">
          Ставишь свои скины и выбираешь скин дороже. Чем больше разница в цене, тем меньше шанс. Если не повезло,
          ставка сгорает.
        </p>
      </div>
      <Upgrader
        edge={upgradeEdge}
        maxChance={upgradeMaxChance}
        inventory={inv.map((r) => ({
          id: r.id,
          name: r.item.name,
          rarity: r.item.rarity,
          image: r.item.image,
          price: itemPrice(r.item),
        }))}
      />
      {history.length > 0 && (
        <section>
          <h2 className="h2 mb-3">Мои апгрейды</h2>
          <div className="panel divide-y divide-line">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className={`w-20 ${h.success ? "text-ok" : "text-danger"}`}>{h.success ? "Удача" : "Мимо"}</span>
                <span className="flex-1 truncate">
                  {money(h.fromValue)} → {h.target.name}
                </span>
                <span className="text-dust">{h.chance}%</span>
                <span className="w-24 text-right">{money(h.targetPrice)}</span>
                <span className="w-14 text-right text-dust">{ago(h.createdAt)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { sellPrice } from "@/lib/pricing";
import { money } from "@/lib/format";
import ItemCard from "@/components/ItemCard";
import SellButton from "@/components/SellButton";

export const dynamic = "force-dynamic";

export default async function InventoryPage({ searchParams }: { searchParams: { tab?: string } }) {
  const user = await requireUser();
  const { sellCommission } = await getSettings();
  const showSold = searchParams.tab === "sold";

  const inv = await prisma.inventoryItem.findMany({
    where: { userId: user.id, isSold: showSold },
    orderBy: showSold ? { soldAt: "desc" } : { acquiredAt: "desc" },
    include: { item: { include: { catalog: true } } },
    take: 300,
  });

  const rows = inv.map((r) => ({ ...r, sell: sellPrice(r.item, sellCommission) }));
  const total = rows.reduce((s, r) => s + r.sell, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h1">Инвентарь</h1>
          <div className="mt-3 flex gap-4 text-sm">
            <Link href="/inventory" className={showSold ? "text-dust hover:text-bone" : "text-stencil"}>
              На руках
            </Link>
            <Link href="/inventory?tab=sold" className={showSold ? "text-stencil" : "text-dust hover:text-bone"}>
              Проданные
            </Link>
          </div>
        </div>
        {!showSold && rows.length > 0 && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-dust">
              {rows.length} шт. Комиссия при продаже {sellCommission}%
            </span>
            <SellButton all total={total} label={`Продать всё за ${money(total)}`} />
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="panel p-8 text-center">
          <p className="text-dust">{showSold ? "Ты ещё ничего не продавал." : "Инвентарь пуст."}</p>
          {!showSold && (
            <Link href="/" className="btn-primary mt-4">
              Выбрать кейс
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {rows.map((r) => (
            <ItemCard
              key={r.id}
              name={r.item.name}
              rarity={r.item.rarity}
              image={r.item.image}
              wear={r.item.wear}
              price={showSold ? (r.upgraded ? r.dropPrice : r.soldPrice ?? 0) : r.sell}
              footer={
                showSold ? (
                  <span className="text-xs text-dust">{r.upgraded ? "Ушёл в апгрейд" : "Продан"}</span>
                ) : (
                  <SellButton ids={[r.id]} total={r.sell} label="Продать" />
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

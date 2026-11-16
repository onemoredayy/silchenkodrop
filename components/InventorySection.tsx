import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { sellPrice } from "@/lib/pricing";
import { money } from "@/lib/format";
import ItemCard from "@/components/ItemCard";
import SellButton from "@/components/SellButton";
import Pager from "@/components/Pager";

const PER_PAGE = 24; // 4 ряда по 6 карточек (на телефоне 8 по 3)

// Инвентарь игрока — блок на странице профиля (/profile?tab=sold&page=2#inventory)
export default async function InventorySection({ userId, searchParams }: { userId: string; searchParams: { tab?: string; page?: string } }) {
  const user = { id: userId };
  const { sellCommission } = await getSettings();
  const showSold = searchParams.tab === "sold";
  const where = { userId: user.id, isSold: showSold };

  const count = await prisma.inventoryItem.count({ where });
  const pages = Math.max(1, Math.ceil(count / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(searchParams.page)) || 1));

  const [inv, all] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      orderBy: showSold ? { soldAt: "desc" } : { acquiredAt: "desc" },
      include: { item: { include: { catalog: true } } },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    // сумма «Продать всё» считается по всему инвентарю, а не только по открытой странице
    prisma.inventoryItem.findMany({
      where,
      select: { item: { select: { price: true, catalog: { select: { price: true } } } } },
      take: showSold ? 0 : undefined, // для проданных сумма не нужна
    }),
  ]);

  const rows = inv.map((r) => ({ ...r, sell: sellPrice(r.item, sellCommission) }));
  const total = Math.round(all.reduce((s, r) => s + sellPrice(r.item, sellCommission), 0) * 100) / 100;
  const pageHref = (p: number) => `/profile?${showSold ? "tab=sold&" : ""}page=${p}#inventory`;

  return (
    <section id="inventory" className="scroll-mt-4 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="h2">Инвентарь</h2>
          <div className="mt-3 flex gap-4 text-sm">
            <Link href="/profile#inventory" className={showSold ? "text-dust hover:text-bone" : "text-stencil"}>
              На руках
            </Link>
            <Link href="/profile?tab=sold#inventory" className={showSold ? "text-stencil" : "text-dust hover:text-bone"}>
              Проданные
            </Link>
          </div>
        </div>
        {!showSold && count > 0 && (
          <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:gap-4">
            <span className="text-sm text-dust">
              {count} шт. Комиссия при продаже {sellCommission}%
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
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:grid-cols-6">
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

      <Pager page={page} pages={pages} href={pageHref} />
    </section>
  );
}

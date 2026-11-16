import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ago, money } from "@/lib/format";
import { rarityColor } from "@/lib/rarity";
import { itemPrice } from "@/lib/pricing";
import Avatar from "@/components/Avatar";
import SkinImage from "@/components/SkinImage";
import ItemCard from "@/components/ItemCard";

export const dynamic = "force-dynamic";

// Публичный профиль: то, что видно любому посетителю (без баланса и истории денег)
export default async function PublicProfile({ params }: { params: { id: string } }) {
  const u = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, username: true, avatar: true, steamId: true, role: true, createdAt: true },
  });
  if (!u) notFound();

  const [me, agg, best, recent, inv, battles, wins] = await Promise.all([
    getCurrentUser(),
    prisma.opening.aggregate({ where: { userId: u.id }, _count: true, _sum: { itemPrice: true } }),
    prisma.opening.findFirst({ where: { userId: u.id }, orderBy: { itemPrice: "desc" }, include: { item: true, case: true } }),
    prisma.opening.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 10, include: { item: true, case: true } }),
    prisma.inventoryItem.findMany({ where: { userId: u.id, isSold: false }, include: { item: { include: { catalog: true } } } }),
    prisma.battlePlayer.count({ where: { userId: u.id, battle: { status: "DONE" } } }),
    prisma.battle.count({ where: { winnerId: u.id } }),
  ]);

  const invSorted = inv.map((r) => ({ ...r, price: itemPrice(r.item) })).sort((a, b) => b.price - a.price);
  const invValue = invSorted.reduce((s, r) => s + r.price, 0);
  const stats = [
    { label: "Открыто кейсов", value: agg._count.toLocaleString("ru-RU") },
    { label: "Выбито на сумму", value: money(agg._sum.itemPrice ?? 0) },
    { label: "Батлов выиграно", value: `${wins} из ${battles}` },
    { label: "Инвентарь", value: money(invValue) },
  ];

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-center gap-4 sm:gap-5">
        <Avatar src={u.avatar} name={u.username} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="h1 truncate">{u.username}</h1>
          <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-dust">
            <a href={`https://steamcommunity.com/profiles/${u.steamId}`} target="_blank" rel="noreferrer" className="hover:text-bone">
              Профиль Steam
            </a>
            {u.role === "ADMIN" && <span className="text-stencil">администратор</span>}
            <span>на сайте с {u.createdAt.toLocaleDateString("ru-RU")}</span>
          </div>
        </div>
        {me?.id === u.id && (
          <Link href="/profile" className="btn-ghost">
            Мой кабинет
          </Link>
        )}
      </section>

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-panel p-3 sm:p-4">
            <div className="text-sm text-dust">{s.label}</div>
            <div className="mt-1 font-display text-xl sm:text-2xl">{s.value}</div>
          </div>
        ))}
      </section>

      {best && (
        <section className="panel flex flex-wrap items-center gap-4 p-4" style={{ boxShadow: `inset 4px 0 0 ${rarityColor(best.item.rarity)}` }}>
          <SkinImage src={best.item.image} name={best.item.name} className="h-16 w-24" />
          <div className="min-w-0">
            <div className="text-sm text-dust">Лучший дроп</div>
            <div className="font-display text-lg">{best.item.name}</div>
            <div className="text-sm text-dust">
              {money(best.itemPrice)} из кейса «{best.case.name}»
            </div>
          </div>
        </section>
      )}

      {invSorted.length > 0 && (
        <section>
          <h2 className="h2 mb-3">
            Инвентарь <span className="text-base text-dust">· {invSorted.length} шт.</span>
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
            {invSorted.slice(0, 10).map((r) => (
              <ItemCard key={r.id} name={r.item.name} rarity={r.item.rarity} image={r.item.image} wear={r.item.wear} price={r.price} />
            ))}
          </div>
          {invSorted.length > 10 && <p className="mt-2 text-sm text-dust">Показаны 10 самых дорогих.</p>}
        </section>
      )}

      <section>
        <h2 className="h2 mb-3">Последние открытия</h2>
        {recent.length === 0 ? (
          <div className="panel p-4 text-dust">Ещё ничего не открыл.</div>
        ) : (
          <div className="panel divide-y divide-line">
            {recent.map((o) => (
              <div key={o.id} className="flex items-center gap-3 px-3 py-2 text-sm sm:px-4">
                <span className="h-8 w-1 shrink-0 rounded-sm" style={{ background: rarityColor(o.item.rarity) }} />
                <SkinImage src={o.item.image} name={o.item.name} className="h-8 w-12 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{o.item.name}</span>
                <Link href={`/case/${o.case.slug}`} className="hidden truncate text-dust hover:text-bone sm:inline">
                  {o.case.name}
                </Link>
                <span className="w-20 text-right sm:w-24">{money(o.itemPrice)}</span>
                <span className="w-12 text-right text-dust">{ago(o.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ago, money } from "@/lib/format";
import Notice from "@/components/Notice";
import { updatePricesNow } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminHome({ searchParams }: { searchParams: { msg?: string; error?: string } }) {
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
  const [users, openings, day, balances, catalog, priced, recent, broken] = await Promise.all([
    prisma.user.count(),
    prisma.opening.aggregate({ _count: true, _sum: { pricePaid: true, itemPrice: true } }),
    prisma.opening.aggregate({ where: { createdAt: { gte: dayAgo } }, _count: true, _sum: { pricePaid: true, itemPrice: true } }),
    prisma.user.aggregate({ _sum: { balance: true } }),
    prisma.skinCatalog.count(),
    prisma.skinCatalog.count({ where: { price: { not: null } } }),
    prisma.opening.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { user: true, item: true, case: true } }),
    prisma.case.findMany({ include: { items: true } }),
  ]);
  const pricesAt = await prisma.siteSetting.findUnique({ where: { key: "pricesUpdatedAt" } });
  const badCases = broken.filter((c) => Math.abs(c.items.reduce((s, r) => s + r.dropChance, 0) - 100) > 0.01);

  const profit = (openings._sum.pricePaid ?? 0) - (openings._sum.itemPrice ?? 0);
  const dayProfit = (day._sum.pricePaid ?? 0) - (day._sum.itemPrice ?? 0);
  const cells = [
    { l: "Игроков", v: users.toLocaleString("ru-RU") },
    { l: "Открытий всего", v: openings._count.toLocaleString("ru-RU") },
    { l: "Открытий за сутки", v: day._count.toLocaleString("ru-RU") },
    { l: "На балансах игроков", v: money(balances._sum.balance ?? 0) },
    { l: "Доход сайта всего", v: money(profit) },
    { l: "Доход за сутки", v: money(dayProfit) },
    { l: "Скинов в каталоге", v: catalog.toLocaleString("ru-RU") },
    { l: "С ценой Steam", v: priced.toLocaleString("ru-RU") },
  ];

  return (
    <div className="space-y-8">
      <h1 className="h1">Сводка</h1>
      {searchParams.msg && <p className="rounded border border-ok/50 px-3 py-2 text-sm text-ok">{searchParams.msg}</p>}
      <Notice error={searchParams.error} />
      <form action={updatePricesNow} className="panel flex flex-wrap items-center gap-3 p-4 text-sm">
        <span className="flex-1 text-dust">
          Цены Steam обновляются сами каждые 6 часов.{" "}
          {pricesAt ? `Последний раз — ${ago(new Date(pricesAt.value))} назад.` : "Ещё ни разу не обновлялись."}
        </span>
        <button className="btn-ghost">Обновить цены сейчас</button>
      </form>
      {badCases.length > 0 && (
        <div className="rounded border border-stencil/50 p-3 text-sm text-stencil">
          Сумма шансов не равна 100% в кейсах:{" "}
          {badCases.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ", "}
              <Link href={`/admin/cases/${c.id}`} className="underline">
                {c.name}
              </Link>
            </span>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line lg:grid-cols-4">
        {cells.map((c) => (
          <div key={c.l} className="bg-panel p-4">
            <div className="text-sm text-dust">{c.l}</div>
            <div className="mt-1 font-display text-xl">{c.v}</div>
          </div>
        ))}
      </div>
      <section>
        <h2 className="h2 mb-3">Последние открытия</h2>
        <div className="panel overflow-x-auto px-4">
          <table className="table">
            <thead>
              <tr><th>Игрок</th><th>Кейс</th><th>Предмет</th><th className="text-right">Цена кейса</th><th className="text-right">Выпало на</th><th className="text-right">Когда</th></tr>
            </thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.id}>
                  <td>{o.user.username}</td>
                  <td>{o.case.name}</td>
                  <td>{o.item.name}</td>
                  <td className="text-right">{money(o.pricePaid)}</td>
                  <td className="text-right">{money(o.itemPrice)}</td>
                  <td className="text-right text-dust">{ago(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

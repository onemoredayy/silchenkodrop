import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ago, money } from "@/lib/format";
import { rarityColor } from "@/lib/rarity";
import Avatar from "@/components/Avatar";
import SkinImage from "@/components/SkinImage";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();
  const [agg, best, recent, favourite] = await Promise.all([
    prisma.opening.aggregate({ where: { userId: user.id }, _count: true, _sum: { pricePaid: true, itemPrice: true } }),
    prisma.opening.findFirst({ where: { userId: user.id }, orderBy: { itemPrice: "desc" }, include: { item: true, case: true } }),
    prisma.opening.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { item: true, case: true },
    }),
    prisma.opening.groupBy({
      by: ["caseId"],
      where: { userId: user.id },
      _count: { caseId: true },
      orderBy: { _count: { caseId: "desc" } },
      take: 1,
    }),
  ]);
  const favCase = favourite[0]
    ? await prisma.case.findUnique({ where: { id: favourite[0].caseId } })
    : null;

  const spent = agg._sum.pricePaid ?? 0;
  const got = agg._sum.itemPrice ?? 0;

  const stats = [
    { label: "Открыто кейсов", value: agg._count.toLocaleString("ru-RU") },
    { label: "Потрачено", value: money(spent) },
    { label: "Выбито на сумму", value: money(got) },
    { label: "Итог", value: `${got - spent >= 0 ? "+" : "−"}${money(Math.abs(got - spent))}` },
  ];

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-center gap-5">
        <Avatar src={user.avatar} name={user.username} size={88} />
        <div className="min-w-0 flex-1">
          <h1 className="h1 truncate">{user.username}</h1>
          <div className="mt-1 text-sm text-dust">
            <a
              href={`https://steamcommunity.com/profiles/${user.steamId}`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-bone"
            >
              Профиль Steam
            </a>
            {user.role === "ADMIN" && <span className="ml-3 text-stencil">администратор</span>}
            {favCase && <span className="ml-3">Любимый кейс: {favCase.name}</span>}
          </div>
        </div>
        <form action="/api/auth/logout" method="post">
          <button className="btn-ghost">Выйти</button>
        </form>
      </section>

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-panel p-4">
            <div className="text-sm text-dust">{s.label}</div>
            <div className="mt-1 font-display text-2xl">{s.value}</div>
          </div>
        ))}
      </section>

      {best && (
        <section className="panel flex flex-wrap items-center gap-4 p-4" style={{ boxShadow: `inset 4px 0 0 ${rarityColor(best.item.rarity)}` }}>
          <SkinImage src={best.item.image} name={best.item.name} className="h-16 w-24" />
          <div>
            <div className="text-sm text-dust">Лучший дроп</div>
            <div className="font-display text-lg">{best.item.name}</div>
            <div className="text-sm text-dust">
              {money(best.itemPrice)} из кейса «{best.case.name}»
            </div>
          </div>
        </section>
      )}

      <section>
        <h2 className="h2 mb-4">Последние открытия</h2>
        {recent.length === 0 ? (
          <div className="panel p-6 text-dust">
            Ещё ничего не открыто. <Link href="/" className="text-stencil hover:underline">К кейсам</Link>
          </div>
        ) : (
          <div className="panel divide-y divide-line">
            {recent.map((o) => (
              <div key={o.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="h-8 w-1 shrink-0 rounded-sm" style={{ background: rarityColor(o.item.rarity) }} />
                <SkinImage src={o.item.image} name={o.item.name} className="h-8 w-12 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{o.item.name}</span>
                <span className="hidden truncate text-dust sm:inline">{o.case.name}</span>
                <span className="w-24 text-right">{money(o.itemPrice)}</span>
                <span className="w-16 text-right text-dust">{ago(o.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

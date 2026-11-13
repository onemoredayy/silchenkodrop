import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { itemPrice } from "@/lib/pricing";
import { rarityColor, rarityLabel } from "@/lib/rarity";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminItems({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? "").trim();
  const items = await prisma.item.findMany({
    where: q ? { name: { contains: q } } : {},
    orderBy: { name: "asc" },
    include: { catalog: true, _count: { select: { cases: true } } },
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="h1">Предметы</h1>
        <Link href="/admin/items/new" className="btn-primary">Новый предмет</Link>
      </div>
      <form>
        <input name="q" defaultValue={q} placeholder="Поиск по названию" className="input max-w-sm" />
      </form>
      <div className="panel overflow-x-auto px-4">
        <table className="table">
          <thead>
            <tr><th>Предмет</th><th>Редкость</th><th className="text-right">Цена</th><th>Источник цены</th><th className="text-right">В кейсах</th></tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td><Link href={`/admin/items/${i.id}`} className="hover:text-stencil">{i.name}</Link></td>
                <td style={{ color: rarityColor(i.rarity) }}>{rarityLabel(i.rarity)}</td>
                <td className="text-right">{money(itemPrice(i))}</td>
                <td className="text-dust">{i.catalog?.price ? "Steam" : i.marketHashName ? "ручная (в Steam пока нет)" : "ручная"}</td>
                <td className="text-right">{i._count.cases}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { suggestedCasePrice } from "@/lib/pricing";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminCases() {
  const [cases, { margin }] = await Promise.all([
    prisma.case.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { items: { include: { item: { include: { catalog: true } } } }, _count: { select: { openings: true } } },
    }),
    getSettings(),
  ]);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">Кейсы</h1>
        <Link href="/admin/cases/new" className="btn-primary">Новый кейс</Link>
      </div>
      <div className="panel overflow-x-auto px-4">
        <table className="table">
          <thead>
            <tr><th>Название</th><th className="text-right">Цена</th><th className="text-right">Средний дроп</th><th className="text-right">Шансы</th><th className="text-right">Открытий</th><th>Статус</th></tr>
          </thead>
          <tbody>
            {cases.map((c) => {
              const { ev } = suggestedCasePrice(c.items, margin);
              const sum = Math.round(c.items.reduce((s, r) => s + r.dropChance, 0) * 100) / 100;
              return (
                <tr key={c.id}>
                  <td><Link href={`/admin/cases/${c.id}`} className="hover:text-stencil">{c.name}</Link></td>
                  <td className="text-right">{money(c.price)}</td>
                  <td className={`text-right ${ev > c.price ? "text-danger" : "text-dust"}`} title="Средняя цена выпадающего предмета">{money(ev)}</td>
                  <td className={`text-right ${Math.abs(sum - 100) > 0.01 ? "text-danger" : "text-dust"}`}>{sum}%</td>
                  <td className="text-right">{c._count.openings}</td>
                  <td className={c.isActive ? "text-ok" : "text-dust"}>{c.isActive ? "Включён" : "Выключен"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-dust">Красный «средний дроп» значит, что кейс в среднем отдаёт больше, чем стоит.</p>
    </div>
  );
}

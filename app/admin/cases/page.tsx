import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function toggleActive(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id"));
  const isActive = formData.get("isActive") === "1";
  await prisma.case.update({ where: { id }, data: { isActive: !isActive } });
  revalidatePath("/admin/cases");
  revalidatePath("/");
}

export default async function AdminCasesPage() {
  const cases = await prisma.case.findMany({
    orderBy: { price: "asc" },
    include: { _count: { select: { items: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Кейсы</h2>
        <Link href="/admin/cases/new">
          <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
            + Новый кейс
          </Button>
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Название</th>
              <th className="px-4 py-2">Цена</th>
              <th className="px-4 py-2">Предметов</th>
              <th className="px-4 py-2">Статус</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {cases.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2 font-medium">{c.name}</td>
                <td className="px-4 py-2">{c.price.toLocaleString("ru-RU")} ₽</td>
                <td className="px-4 py-2">{c._count.items}</td>
                <td className="px-4 py-2">
                  <form action={toggleActive}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="isActive" value={c.isActive ? "1" : "0"} />
                    <button
                      type="submit"
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        c.isActive
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-zinc-500/20 text-zinc-400"
                      }`}
                    >
                      {c.isActive ? "Показан" : "Скрыт"}
                    </button>
                  </form>
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/admin/cases/${c.id}`}
                    className="text-violet-300 underline underline-offset-4"
                  >
                    Изменить
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cases.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-muted-foreground">
          Кейсов пока нет.
        </p>
      ) : null}
    </div>
  );
}

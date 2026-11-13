import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Notice from "@/components/Notice";
import { deleteSection, saveSection } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminSections({ searchParams }: { searchParams: { error?: string; ok?: string } }) {
  const sections = await prisma.caseSection.findMany({
    orderBy: { sortOrder: "asc" },
    include: { cases: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, isActive: true } } },
  });
  return (
    <div className="space-y-6">
      <h1 className="h1">Блоки кейсов</h1>
      <Notice {...searchParams} />
      <p className="text-sm text-dust">
        Блоки идут на главной по порядку. Чтобы перенести кейс в другой блок, открой кейс и выбери блок.
      </p>
      {sections.map((s) => (
        <div key={s.id} className="panel p-4">
          <form action={saveSection} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={s.id} />
            <label className="min-w-[14rem] flex-1 space-y-1">
              <span className="text-xs text-dust">Название</span>
              <input name="name" defaultValue={s.name} className="input" />
            </label>
            <label className="w-24 space-y-1">
              <span className="text-xs text-dust">Порядок</span>
              <input name="sortOrder" type="number" defaultValue={s.sortOrder} className="input" />
            </label>
            <button className="btn-ghost">Сохранить</button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {s.cases.length === 0 && <span className="text-dust">Пусто</span>}
            {s.cases.map((c) => (
              <Link key={c.id} href={`/admin/cases/${c.id}`} className={`rounded border border-line px-2 py-1 hover:border-stencil ${c.isActive ? "" : "text-dust line-through"}`}>
                {c.name}
              </Link>
            ))}
          </div>
          <form action={deleteSection} className="mt-3">
            <input type="hidden" name="id" value={s.id} />
            <button className="text-xs text-danger hover:underline">Удалить блок (кейсы останутся)</button>
          </form>
        </div>
      ))}
      <form action={saveSection} className="panel flex flex-wrap items-end gap-2 p-4">
        <label className="min-w-[14rem] flex-1 space-y-1">
          <span className="text-xs text-dust">Новый блок</span>
          <input name="name" placeholder="Название" className="input" />
        </label>
        <label className="w-24 space-y-1">
          <span className="text-xs text-dust">Порядок</span>
          <input name="sortOrder" type="number" defaultValue={sections.length} className="input" />
        </label>
        <button className="btn-primary">Добавить</button>
      </form>
    </div>
  );
}

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { itemPrice, suggestedCasePrice } from "@/lib/pricing";
import { rarityColor, RARITIES } from "@/lib/rarity";
import { money } from "@/lib/format";
import Notice from "@/components/Notice";
import { deleteCase, saveCase, saveChances } from "../../actions";

export const dynamic = "force-dynamic";

type SP = { error?: string; ok?: string; warn?: string };

export default async function EditCase({ params, searchParams }: { params: { id: string }; searchParams: SP }) {
  const isNew = params.id === "new";
  const kase = isNew
    ? null
    : await prisma.case.findUnique({
        where: { id: params.id },
        include: { items: { include: { item: { include: { catalog: true } } } } },
      });
  if (!isNew && !kase) notFound();

  const [{ margin }, sections, allItems] = await Promise.all([
    getSettings(),
    prisma.caseSection.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.skinCatalog.findMany({
      where: { isDefault: true },
      select: { baseName: true, price: true },
      orderBy: { baseName: "asc" },
    }),
  ]);

  const rows = (kase?.items ?? []).sort(
    (a, b) => RARITIES.indexOf(a.item.rarity as never) - RARITIES.indexOf(b.item.rarity as never),
  );
  const { ev, suggested } = suggestedCasePrice(rows, margin);
  const sum = Math.round(rows.reduce((s, r) => s + r.dropChance, 0) * 100) / 100;
  const inCaseNames = new Set(rows.map((r) => r.item.name));

  return (
    <div className="space-y-8">
      <h1 className="h1">{isNew ? "Новый кейс" : kase!.name}</h1>
      <Notice {...searchParams} />

      <form action={saveCase} className="panel grid gap-4 p-5 sm:grid-cols-2">
        <input type="hidden" name="id" value={kase?.id ?? ""} />
        <label className="space-y-1">
          <span className="text-sm text-dust">Название</span>
          <input name="name" defaultValue={kase?.name} required className="input" />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-dust">Адрес (латиницей, можно пусто)</span>
          <input name="slug" defaultValue={kase?.slug} className="input" />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-dust">Цена кейса, ₽</span>
          <input name="price" type="number" step="0.01" min="0.01" defaultValue={kase?.price} required className="input" />
          {!isNew && (
            <span className="block text-xs text-dust">
              Средний дроп {money(ev)}. С маржой {margin}% получилось бы {money(suggested)} — это только подсказка.
            </span>
          )}
        </label>
        <label className="space-y-1">
          <span className="text-sm text-dust">Блок на главной</span>
          <select name="sectionId" defaultValue={kase?.sectionId ?? ""} className="input">
            <option value="">Без блока («Другие кейсы»)</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm text-dust">Порядок внутри блока</span>
          <input name="sortOrder" type="number" defaultValue={kase?.sortOrder ?? 0} className="input" />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-dust">Картинка (ссылка; пусто — покажется название)</span>
          <input name="image" defaultValue={kase?.image ?? ""} className="input" />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm text-dust">Описание</span>
          <textarea name="description" defaultValue={kase?.description ?? ""} rows={2} className="input h-auto py-2" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={kase?.isActive ?? false} className="accent-stencil" />
          Показывать на сайте
        </label>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button className="btn-primary">{isNew ? "Создать кейс" : "Сохранить"}</button>
        </div>
      </form>

      {kase && (
        <form action={saveChances} className="space-y-3">
          <input type="hidden" name="caseId" value={kase.id} />
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="h2">Предметы и шансы</h2>
            <span className={`text-sm ${Math.abs(sum - 100) > 0.01 ? "text-danger" : "text-dust"}`}>
              Сейчас в сумме {sum}% из 100%
            </span>
          </div>
          <div className="panel overflow-x-auto px-4">
            <table className="table">
              <thead>
                <tr>
                  <th>Предмет</th>
                  <th className="text-right">Цена</th>
                  <th className="w-32">Шанс, %</th>
                  <th className="text-right">Убрать</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="mr-2 inline-block h-3 w-1 align-middle" style={{ background: rarityColor(r.item.rarity) }} />
                      {r.item.name}
                    </td>
                    <td className="text-right">{money(itemPrice(r.item))}</td>
                    <td>
                      <input name={`chance_${r.id}`} type="number" step="0.0001" min="0" defaultValue={r.dropChance} className="input h-8" />
                    </td>
                    <td className="text-right">
                      <input type="checkbox" name={`remove_${r.id}`} className="accent-danger" aria-label={`Убрать ${r.item.name}`} />
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2}>
                    <input name="addName" list="skins" placeholder="Добавить скин: начни вводить название" className="input h-8" />
                    <datalist id="skins">
                      {allItems
                        .filter((i) => !inCaseNames.has(i.baseName))
                        .map((i) => (
                          <option key={i.baseName} value={i.baseName}>
                            {money(i.price)}
                          </option>
                        ))}
                    </datalist>
                  </td>
                  <td>
                    <input name="addChance" type="number" step="0.0001" min="0" placeholder="шанс" className="input h-8" />
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <button className="btn-primary">Сохранить шансы</button>
          </div>
        </form>
      )}

      {kase && (
        <form action={deleteCase} className="border-t border-line pt-6">
          <input type="hidden" name="id" value={kase.id} />
          <button className="btn-danger">Удалить кейс вместе с историей открытий</button>
        </form>
      )}
    </div>
  );
}

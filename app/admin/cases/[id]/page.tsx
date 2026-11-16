import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { itemPrice, suggestedCasePrice } from "@/lib/pricing";
import { rarityColor, RARITIES } from "@/lib/rarity";
import { money } from "@/lib/format";
import Notice from "@/components/Notice";
import { autoFillCase, deleteCase, saveCase, saveChances, tuneCaseRtp } from "../../actions";
import { caseRtp } from "@/lib/rtp";

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
  const rtp = kase ? caseRtp(ev, kase.price) : 0;
  const prices = rows.map((r) => itemPrice(r.item));

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
        <div className="space-y-2 sm:col-span-2">
          <span className="text-sm text-dust">Картинка кейса</span>
          <div className="flex flex-wrap items-center gap-3">
            {kase?.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={kase.image} alt="" className="h-20 w-24 rounded border border-line bg-raised object-contain p-1" />
            )}
            <input
              type="file"
              name="imageFile"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
              className="max-w-full text-sm text-dust file:mr-3 file:h-10 file:cursor-pointer file:rounded file:border file:border-line file:bg-transparent file:px-4 file:text-sm file:font-semibold file:text-bone"
            />
          </div>
          {kase?.image && (
            <label className="flex items-center gap-2 text-sm text-dust">
              <input type="checkbox" name="removeImage" className="accent-danger" /> Убрать картинку
            </label>
          )}
          <span className="block text-xs text-dust">
            Выбери файл с телефона или компа (PNG, JPG, WEBP, GIF, до 8 МБ). Лучше PNG с прозрачным фоном. Если ничего не выбирать, останется текущая картинка.
          </span>
        </div>
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
        <section className="panel space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <h2 className="h2">RTP</h2>
            <div className="font-display text-3xl" style={{ color: rtp > 100 ? "#e0614a" : rtp >= 80 ? "#8fbf6a" : "#e0b43a" }}>
              {rows.length ? `${rtp}%` : "—"}
            </div>
            <div className="text-sm text-dust">
              Средний дроп {money(ev)} при цене {money(kase.price)}.{" "}
              {rtp > 100 ? "Кейс в минус сайту." : rtp ? `Сайт в среднем оставляет ${money(kase.price - ev)} с открытия.` : ""}
            </div>
          </div>
          {/* полоска: 0–150% */}
          <div className="relative h-2 rounded bg-raised">
            <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${Math.min(100, (rtp / 150) * 100)}%`, background: rtp > 100 ? "#e0614a" : "#e0b43a" }} />
            <div className="absolute inset-y-[-3px] w-px bg-bone" style={{ left: `${(100 / 150) * 100}%` }} title="100%" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <form action={tuneCaseRtp} className="space-y-2 rounded border border-line p-3">
              <input type="hidden" name="caseId" value={kase.id} />
              <div className="font-medium">Подобрать шансы</div>
              <p className="text-xs text-dust">Предметы остаются те же, меняются только шансы (дорогие — реже) и цена кейса.</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-xs text-dust">RTP, %</span>
                  <input name="rtp" type="number" step="0.1" min="1" max="500" defaultValue={rtp && rtp < 500 ? Math.round(rtp) : 85} className="input" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-dust">Цена кейса, ₽</span>
                  <input name="price" type="number" step="0.01" min="0.01" defaultValue={kase.price} className="input" />
                </label>
              </div>
              {prices.length > 1 && (
                <p className="text-xs text-dust">
                  Возможный средний дроп: от {money(Math.min(...prices))} до {money(Math.max(...prices))}.
                </p>
              )}
              <button className="btn-primary w-full" disabled={rows.length < 2}>Подобрать шансы</button>
            </form>

            <form action={autoFillCase} className="space-y-2 rounded border border-line p-3">
              <input type="hidden" name="caseId" value={kase.id} />
              <div className="font-medium">Собрать кейс автоматически</div>
              <p className="text-xs text-dust">Сайт сам возьмёт скины из каталога (от дешёвых до топа) и выставит шансы. Текущие предметы заменятся.</p>
              <div className="grid grid-cols-3 gap-2">
                <label className="space-y-1">
                  <span className="text-xs text-dust">RTP, %</span>
                  <input name="rtp" type="number" step="0.1" min="1" max="500" defaultValue={85} className="input" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-dust">Цена, ₽</span>
                  <input name="price" type="number" step="0.01" min="0.01" defaultValue={kase.price} className="input" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-dust">Предметов</span>
                  <input name="count" type="number" min="3" max="30" defaultValue={12} className="input" />
                </label>
              </div>
              <button className="btn-ghost w-full">Собрать (можно жать ещё раз)</button>
            </form>
          </div>
        </section>
      )}

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

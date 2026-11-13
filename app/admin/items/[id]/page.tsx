import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RARITIES, rarityLabel } from "@/lib/rarity";
import { money } from "@/lib/format";
import Notice from "@/components/Notice";
import SkinImage from "@/components/SkinImage";
import { wearRu } from "@/components/ItemCard";
import { deleteItem, linkItemToCatalog, saveItem } from "../../actions";

export const dynamic = "force-dynamic";

const WEARS = ["Factory New", "Minimal Wear", "Field-Tested", "Well-Worn", "Battle-Scarred"];

type SP = { error?: string; ok?: string; find?: string };

export default async function EditItem({ params, searchParams }: { params: { id: string }; searchParams: SP }) {
  const isNew = params.id === "new";
  const item = isNew ? null : await prisma.item.findUnique({ where: { id: params.id }, include: { catalog: true } });
  if (!isNew && !item) notFound();

  const find = (searchParams.find ?? "").trim();
  const found = find
    ? await prisma.skinCatalog.findMany({ where: { name: { contains: find } }, take: 24, orderBy: { name: "asc" } })
    : [];

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        {item && <SkinImage src={item.image} name={item.name} className="h-16 w-24" />}
        <h1 className="h1">{isNew ? "Новый предмет" : item!.name}</h1>
      </div>
      <Notice {...searchParams} />

      <section className="space-y-3">
        <h2 className="h2">Взять из каталога Steam</h2>
        <p className="text-sm text-dust">
          Название, картинка, редкость и качество подставятся сами, цена будет обновляться со Steam Market.
        </p>
        <form className="flex gap-2">
          <input name="find" defaultValue={find} placeholder="Например: Asiimov" className="input max-w-sm" />
          <button className="btn-ghost">Найти</button>
        </form>
        {find && found.length === 0 && <p className="text-sm text-dust">В каталоге ничего не нашлось.</p>}
        {found.length > 0 && (
          <div className="panel divide-y divide-line">
            {found.map((c) => (
              <form key={c.id} action={linkItemToCatalog} className="flex items-center gap-3 px-4 py-2 text-sm">
                <input type="hidden" name="id" value={item?.id ?? ""} />
                <input type="hidden" name="marketHashName" value={c.marketHashName} />
                <SkinImage src={c.image} name={c.name} className="h-8 w-12" />
                <span className="flex-1">{c.marketHashName}</span>
                <span className="text-dust">{money(c.price)}</span>
                <button className="btn-ghost h-8 px-3 text-xs">{item ? "Привязать" : "Создать из этого"}</button>
              </form>
            ))}
          </div>
        )}
      </section>

      <form action={saveItem} className="panel grid gap-4 p-5 sm:grid-cols-2">
        <input type="hidden" name="id" value={item?.id ?? ""} />
        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm text-dust">Название (как в игре: «AK-47 | Redline»)</span>
          <input name="name" defaultValue={item?.name} required className="input" />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-dust">Редкость</span>
          <select name="rarity" defaultValue={item?.rarity ?? "COMMON"} className="input">
            {RARITIES.map((r) => <option key={r} value={r}>{rarityLabel(r)}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm text-dust">Качество</span>
          <select name="wear" defaultValue={item?.wear ?? "Field-Tested"} className="input">
            <option value="">Нет</option>
            {WEARS.map((w) => <option key={w} value={w}>{wearRu(w)}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm text-dust">Ручная цена, ₽ (если нет цены Steam)</span>
          <input name="price" type="number" step="0.01" min="0" defaultValue={item?.price ?? 0} className="input" />
          {item?.catalog?.price != null && (
            <span className="block text-xs text-dust">Сейчас используется цена Steam: {money(item.catalog.price)}</span>
          )}
        </label>
        <label className="space-y-1">
          <span className="text-sm text-dust">Название на рынке Steam</span>
          <input name="marketHashName" defaultValue={item?.marketHashName ?? ""} placeholder="AK-47 | Redline (Field-Tested)" className="input" />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm text-dust">Картинка (ссылка)</span>
          <input name="image" defaultValue={item?.image ?? ""} className="input" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="statTrak" defaultChecked={item?.statTrak} className="accent-stencil" />
          StatTrak™
        </label>
        <div className="flex justify-end sm:col-span-2">
          <button className="btn-primary">{isNew ? "Создать" : "Сохранить"}</button>
        </div>
      </form>

      {item && (
        <form action={deleteItem} className="border-t border-line pt-6">
          <input type="hidden" name="id" value={item.id} />
          <button className="btn-danger">Удалить предмет</button>
        </form>
      )}
    </div>
  );
}

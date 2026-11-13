import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { RARITIES, rarityLabel } from "@/lib/rarity";
import { ago } from "@/lib/format";
import ItemCard, { wearRu } from "@/components/ItemCard";

const WEARS = ["Factory New", "Minimal Wear", "Field-Tested", "Well-Worn", "Battle-Scarred"];

export const dynamic = "force-dynamic";

const PER_PAGE = 40;

type SP = { q?: string; rarity?: string; weapon?: string; sort?: string; page?: string; wear?: string; st?: string };

export default async function MarketPage({ searchParams }: { searchParams: SP }) {
  const q = (searchParams.q ?? "").trim();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const sort = searchParams.sort ?? "price_desc";

  const where: Prisma.SkinCatalogWhereInput = {
    ...(q ? { name: { contains: q } } : {}),
    ...(searchParams.rarity ? { rarity: searchParams.rarity } : {}),
    ...(searchParams.weapon ? { weapon: searchParams.weapon } : {}),
    ...(searchParams.wear ? { wear: searchParams.wear } : {}),
    ...(searchParams.st === "1" ? { statTrak: true } : searchParams.st === "0" ? { statTrak: false } : {}),
  };
  const orderBy: Prisma.SkinCatalogOrderByWithRelationInput =
    sort === "price_asc"
      ? { price: { sort: "asc", nulls: "last" } }
      : sort === "name"
        ? { name: "asc" }
        : { price: { sort: "desc", nulls: "last" } };

  const [total, rows, weapons, lastUpdate] = await Promise.all([
    prisma.skinCatalog.count({ where }),
    prisma.skinCatalog.findMany({ where, orderBy, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    prisma.skinCatalog.findMany({ distinct: ["weapon"], select: { weapon: true }, orderBy: { weapon: "asc" } }),
    prisma.skinCatalog.findFirst({ where: { lastPriceUpdate: { not: null } }, orderBy: { lastPriceUpdate: "desc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const link = (patch: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged = { ...searchParams, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, String(v));
    return `/market?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">Каталог скинов</h1>
          <p className="mt-2 text-sm text-dust">
            {total.toLocaleString("ru-RU")} предметов. Цены Steam Market обновляются автоматически
            {lastUpdate?.lastPriceUpdate ? `, последнее обновление ${ago(lastUpdate.lastPriceUpdate)} назад` : ", ещё не обновлялись"}.
          </p>
        </div>
      </div>

      <form className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_160px_160px_160px_130px_150px_auto]">
        <input name="q" defaultValue={q} placeholder="Поиск: Redline, AWP…" className="input" />
        <select name="weapon" defaultValue={searchParams.weapon ?? ""} className="input">
          <option value="">Любое оружие</option>
          {weapons.map((w) => (
            <option key={w.weapon} value={w.weapon}>
              {w.weapon}
            </option>
          ))}
        </select>
        <select name="rarity" defaultValue={searchParams.rarity ?? ""} className="input">
          <option value="">Любая редкость</option>
          {RARITIES.map((r) => (
            <option key={r} value={r}>
              {rarityLabel(r)}
            </option>
          ))}
        </select>
        <select name="wear" defaultValue={searchParams.wear ?? ""} className="input">
          <option value="">Любое качество</option>
          {WEARS.map((w) => (
            <option key={w} value={w}>
              {wearRu(w)}
            </option>
          ))}
        </select>
        <select name="st" defaultValue={searchParams.st ?? ""} className="input">
          <option value="">ST и обычные</option>
          <option value="0">Без StatTrak</option>
          <option value="1">Только StatTrak</option>
        </select>
        <select name="sort" defaultValue={sort} className="input">
          <option value="price_desc">Сначала дорогие</option>
          <option value="price_asc">Сначала дешёвые</option>
          <option value="name">По названию</option>
        </select>
        <button className="btn-primary">Найти</button>
      </form>

      {rows.length === 0 ? (
        <div className="panel p-8 text-center text-dust">
          {total === 0 && !q && !searchParams.rarity && !searchParams.weapon
            ? "Каталог пуст. Загрузи его командой npm run catalog:import."
            : "Ничего не нашлось. Попробуй другое название."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {rows.map((r) => (
            <ItemCard
              key={r.id}
              name={r.statTrak ? r.name.replace(/^(★ )?/, "$1StatTrak™ ") : r.name}
              rarity={r.rarity}
              image={r.image}
              wear={r.wear}
              price={r.price ?? undefined}
              footer={r.price == null ? <span className="text-xs text-dust">Цены пока нет</span> : undefined}
            />
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          {page > 1 ? <Link href={link({ page: String(page - 1) })} className="btn-ghost h-9">Назад</Link> : null}
          <span className="text-dust">
            {page} из {pages}
          </span>
          {page < pages ? <Link href={link({ page: String(page + 1) })} className="btn-ghost h-9">Вперёд</Link> : null}
        </div>
      )}
    </div>
  );
}

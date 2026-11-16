"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";
import { rarityColor, rarityLabel } from "@/lib/rarity";
import ItemCard from "./ItemCard";
import Pager from "./Pager";
import SkinImage from "./SkinImage";
import { lose, unlockAudio, setSoundOn, slowingTicks, soundOn, win } from "@/lib/sfx";

type Inv = { id: string; name: string; rarity: string; image: string | null; wear: string | null; price: number };
type Result = { inventoryId: string; value: number; item: Omit<Inv, "id"> & { id: string } };

const PER_PAGE = 12;
const MIN = 3;
const MAX = 10;
const REVEAL_MS = 1800;

export default function Contractor({ inventory, ret }: { inventory: Inv[]; ret: number }) {
  const router = useRouter();
  const [items, setItems] = useState(inventory);
  const [picked, setPicked] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sound, setSound] = useState(true);
  useEffect(() => setSound(soundOn()), []);

  // сервер прислал новый инвентарь (после продажи и т.п.)
  useEffect(() => setItems(inventory), [inventory]);

  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const cur = Math.min(page, pages);
  const shown = items.slice((cur - 1) * PER_PAGE, cur * PER_PAGE);
  const chosen = items.filter((i) => picked.includes(i.id));
  const value = Math.round(chosen.reduce((s, i) => s + i.price, 0) * 100) / 100;

  function toggle(id: string) {
    if (busy) return;
    setResult(null);
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX ? p : [...p, id]));
  }

  // быстро набрать самые дешёвые скины
  function fillCheap() {
    if (busy) return;
    setResult(null);
    setPicked([...items].sort((a, b) => a.price - b.price).slice(0, MAX).map((i) => i.id));
  }

  async function sign() {
    unlockAudio();
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/contract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inventoryIds: picked }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setError(data.error ?? "Не получилось");
    }
    setRolling(true);
    if (sound) slowingTicks(REVEAL_MS);
    setTimeout(() => {
      setRolling(false);
      if (sound) (data.item.price >= data.value ? win : lose)();
      setBusy(false);
      setResult(data);
      setItems((list) => [
        { ...data.item, id: data.inventoryId },
        ...list.filter((i) => !picked.includes(i.id)),
      ]);
      setPicked([]);
      router.refresh();
    }, REVEAL_MS);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:gap-6">
      <section className="panel order-2 flex flex-col p-3 sm:p-4 lg:order-none">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-medium">Твои скины</span>
          {items.length > 0 && (
            <button onClick={fillCheap} disabled={busy} className="text-sm text-stencil hover:underline disabled:opacity-50">
              Набрать {Math.min(MAX, items.length)} самых дешёвых
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-dust">Инвентарь пуст. Открой пару кейсов, и сюда будет что положить.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-3 sm:grid-cols-4">
              {shown.map((i) => (
                <ItemCard
                  key={i.id}
                  name={i.name}
                  rarity={i.rarity}
                  image={i.image}
                  wear={i.wear}
                  price={i.price}
                  selected={picked.includes(i.id)}
                  onClick={() => toggle(i.id)}
                />
              ))}
            </div>
            <Pager page={cur} pages={pages} onPage={setPage} className="mt-auto pt-3" />
          </>
        )}
      </section>

      <section className="panel order-1 flex flex-col gap-4 p-4 lg:order-none lg:sticky lg:top-4 lg:self-start">
        <div className="flex items-baseline justify-between">
          <span className="font-medium">Контракт</span>
          <span className={`text-sm ${picked.length >= MIN ? "text-bone" : "text-dust"}`}>
            {picked.length} / {MAX}
          </span>
        </div>

        {/* слоты */}
        <div className="grid grid-cols-5 gap-1.5">
          {Array.from({ length: MAX }, (_, i) => {
            const it = chosen[i];
            return (
              <button
                key={i}
                type="button"
                onClick={() => it && toggle(it.id)}
                className={`aspect-square overflow-hidden rounded border ${it ? "border-line bg-raised" : "border-dashed border-line/70"} ${
                  rolling ? "animate-pulse" : ""
                }`}
                style={it ? { boxShadow: `inset 0 -2px 0 ${rarityColor(it.rarity)}` } : undefined}
                title={it ? `${it.name} — убрать` : undefined}
              >
                {it && <SkinImage src={it.image} name={it.name} className="h-full w-full p-1" />}
              </button>
            );
          })}
        </div>

        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-dust">Вложено</span>
            <span>{money(value)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-dust">Можно получить</span>
            <span>{value ? `${money(value * 0.2)} – ${money(value * 5)}` : "—"}</span>
          </div>
        </div>

        <button onClick={sign} disabled={busy || picked.length < MIN} className="btn-primary h-12 w-full text-base">
          {rolling ? "Подписываем…" : picked.length < MIN ? `Выбери ещё ${MIN - picked.length}` : "Подписать контракт"}
        </button>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-dust">
          <input
            type="checkbox"
            checked={sound}
            onChange={(e) => {
              setSound(e.target.checked);
              setSoundOn(e.target.checked);
            }}
            className="accent-stencil"
          />
          Звук
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}

        {result && (
          <div
            className="flex items-center gap-3 rounded border border-line p-3"
            style={{ boxShadow: `inset 4px 0 0 ${rarityColor(result.item.rarity)}` }}
          >
            <SkinImage src={result.item.image} name={result.item.name} className="h-14 w-20 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs" style={{ color: rarityColor(result.item.rarity) }}>
                {rarityLabel(result.item.rarity)}
              </div>
              <div className="truncate font-medium">{result.item.name}</div>
              <div className={`text-sm ${result.item.price >= result.value ? "text-ok" : "text-dust"}`}>
                {money(result.item.price)} ({Math.round((result.item.price / result.value) * 100)}% от вложенного)
              </div>
            </div>
          </div>
        )}
        <p className="text-xs text-dust">
          В среднем контракт возвращает около {ret}% от вложенного. Скин уходит в инвентарь.
        </p>
      </section>
    </div>
  );
}

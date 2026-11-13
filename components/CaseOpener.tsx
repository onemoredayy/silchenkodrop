"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { rarityColor, rarityLabel } from "@/lib/rarity";
import { money } from "@/lib/format";
import SkinImage from "./SkinImage";
import ItemCard from "./ItemCard";
import { playFart } from "@/lib/fart";

type Item = {
  id: string;
  name: string;
  rarity: string;
  image: string | null;
  wear: string | null;
  price: number;
  chance: number;
};
type Base = Omit<Item, "chance">;
type Drop = { inventoryId: string; item: Base; troll: Base | null };

const MAX_COUNT = 5;
const GAP = 6;
const LENGTH = 64;
const WIN_INDEX = 56;
const SPIN_MS = 6500;
const TROLL_PAUSE_MS = 1200; // сколько лента стоит на топе перед пуком
const TROLL_MOVE_MS = 1100;

// Лента только для красоты: победитель уже выбран сервером
function buildStrip(items: Item[], winner: Base, decoy?: Base | null) {
  const total = items.reduce((s, i) => s + i.chance, 0) || 1;
  const pick = () => {
    let r = Math.random() * total;
    for (const it of items) {
      if ((r -= it.chance) <= 0) return it;
    }
    return items[0];
  };
  return Array.from({ length: LENGTH }, (_, i) => {
    // при пук-прокрутке: на WIN_INDEX — топ-предмет, следом — настоящий выигрыш
    if (decoy) {
      if (i === WIN_INDEX) return { ...decoy, chance: 0 };
      if (i === WIN_INDEX + 1) return { ...winner, chance: 0 };
    } else if (i === WIN_INDEX) return { ...winner, chance: 0 };
    return pick();
  });
}

// Одна лента. Крутится каждый раз, когда меняется run (номер запуска).
function Reel({
  items,
  drop,
  run,
  compact,
  onFart,
}: {
  items: Item[];
  drop: Drop | null;
  run: number;
  compact: boolean;
  onFart: () => void;
}) {
  const card = compact ? 112 : 148; // ширина карточки в ленте
  const cardH = compact ? 104 : 148;
  const step = card + GAP;
  const viewport = useRef<HTMLDivElement>(null);
  const fart = useRef(onFart);
  fart.current = onFart;
  const [strip, setStrip] = useState<Item[]>(() =>
    // стартовая лента без случайности, чтобы сервер и браузер нарисовали одно и то же
    items.length ? Array.from({ length: 12 }, (_, i) => items[i % items.length]) : [],
  );
  const [offset, setOffset] = useState(0);
  const [animate, setAnimate] = useState(false);
  const [duration, setDuration] = useState(SPIN_MS);

  useEffect(() => {
    if (!drop || run === 0) return;
    const decoy = drop.troll;
    setAnimate(false);
    setOffset(0);
    setStrip(buildStrip(items, drop.item, decoy));
    const w = viewport.current?.clientWidth ?? 800;
    const centerOn = (index: number, jitter: number) => -(index * step + card / 2 - w / 2 + jitter);

    let timer: ReturnType<typeof setTimeout> | undefined;
    // ждём, пока лента перерисуется в начальной позиции, затем крутим
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        setDuration(SPIN_MS);
        setAnimate(true);
        setOffset(centerOn(WIN_INDEX, (Math.random() - 0.5) * card * (decoy ? 0.3 : 0.7)));
      });
    });
    if (decoy) {
      // Пук-прокрутка: замерли на топе… пук… доезжаем до настоящего предмета
      timer = setTimeout(() => {
        fart.current();
        setDuration(TROLL_MOVE_MS);
        setOffset(centerOn(WIN_INDEX + 1, (Math.random() - 0.5) * card * 0.4));
      }, SPIN_MS + TROLL_PAUSE_MS);
    }
    return () => {
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
    };
    // лента перезапускается только по номеру запуска
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  return (
    <div
      ref={viewport}
      className="relative overflow-hidden border-b border-line bg-ground"
      style={{ height: cardH + 28 }}
    >
      <div
        className="flex h-full items-center"
        style={{
          gap: GAP,
          transform: `translateX(${offset}px)`,
          transition: animate
            ? `transform ${duration}ms ${duration === SPIN_MS ? "cubic-bezier(0.08, 0.6, 0.12, 1)" : "cubic-bezier(0.5, 0, 0.3, 1)"}`
            : "none",
        }}
      >
        {strip.map((it, i) => (
          <div
            key={i}
            className="flex shrink-0 flex-col rounded border border-line bg-panel"
            style={{ width: card, height: cardH }}
          >
            <div className="min-h-0 flex-1 p-2">
              <SkinImage src={it.image} name={it.name} className="h-full w-full" />
            </div>
            <div className="h-[3px]" style={{ background: rarityColor(it.rarity) }} />
            <div className={`truncate px-2 text-xs text-dust ${compact ? "py-1" : "py-1.5"}`}>{it.name}</div>
          </div>
        ))}
      </div>
      {/* указатель */}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-stencil" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[9px] border-x-transparent border-t-stencil" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[7px] border-b-[9px] border-x-transparent border-b-stencil" />
    </div>
  );
}

export default function CaseOpener({
  caseId,
  price,
  items,
  loggedIn,
  balance,
  banned,
  sellCommission,
}: {
  caseId: string;
  price: number;
  items: Item[];
  loggedIn: boolean;
  balance: number;
  banned: boolean;
  sellCommission: number;
}) {
  const router = useRouter();
  const [count, setCount] = useState(1);
  const [reels, setReels] = useState(1); // сколько лент сейчас на экране
  const [run, setRun] = useState(0);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [state, setState] = useState<"idle" | "spinning" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [fast, setFast] = useState(false);
  const [soldIds, setSoldIds] = useState<string[]>([]);
  const [soldTotal, setSoldTotal] = useState(0);
  const [selling, setSelling] = useState(false);
  const [money_, setMoney] = useState(balance);
  const [sound, setSound] = useState(true);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const farted = useRef(false);
  const finishTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(finishTimer.current), []);

  const cost = Math.round(price * count * 100) / 100;
  const busy = state === "spinning";
  const canOpen = loggedIn && !banned && money_ >= cost && !busy && items.length > 0;

  function pickCount(n: number) {
    if (busy) return;
    setCount(n);
    if (state !== "done") setReels(n);
  }

  async function open() {
    setError(null);
    setSoldIds([]);
    setSoldTotal(0);
    setState("spinning");
    const res = await fetch(`/api/cases/${caseId}/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !Array.isArray(data.drops)) {
      setError(data.error ?? "Не получилось открыть кейс");
      setState("idle");
      return;
    }
    // без анимации подставной прокрутки нет, так что и пометка о ней не нужна
    const got = (data.drops as Drop[]).map((d) => (fast ? { ...d, troll: null } : d));
    setMoney(data.balance);
    setDrops(got);
    setReels(got.length);

    const finish = () => {
      setState("done");
      router.refresh();
    };
    if (fast) return finish();

    farted.current = false;
    setRun((r) => r + 1);
    const anyTroll = got.some((d) => d.troll);
    finishTimer.current = setTimeout(
      finish,
      anyTroll ? SPIN_MS + TROLL_PAUSE_MS + TROLL_MOVE_MS + 150 : SPIN_MS + 150,
    );
  }

  // пук один на все ленты, даже если подставных несколько
  function fartOnce() {
    if (farted.current || !soundRef.current) return;
    farted.current = true;
    playFart();
  }

  async function sell(ids: string[]) {
    if (!ids.length || selling) return;
    setSelling(true);
    setError(null);
    const res = await fetch("/api/inventory/sell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    const data = await res.json().catch(() => ({}));
    setSelling(false);
    if (!res.ok) return setError(data.error ?? "Не получилось продать");
    setSoldIds((s) => [...s, ...ids]);
    setSoldTotal((t) => Math.round((t + data.total) * 100) / 100);
    setMoney(data.balance);
    router.refresh();
  }

  const sellFor = (d: Drop) => Math.round(d.item.price * (1 - sellCommission / 100) * 100) / 100;
  const unsold = drops.filter((d) => !soldIds.includes(d.inventoryId));
  const unsoldTotal = Math.round(unsold.reduce((s, d) => s + sellFor(d), 0) * 100) / 100;
  const wonTotal = Math.round(drops.reduce((s, d) => s + d.item.price, 0) * 100) / 100;
  const single = drops.length === 1 ? drops[0] : null;

  return (
    <div className="panel overflow-hidden">
      {/* ленты: по одной на каждый кейс */}
      {Array.from({ length: reels }, (_, i) => (
        <Reel key={i} items={items} drop={drops[i] ?? null} run={run} compact={reels > 1} onFart={fartOnce} />
      ))}

      {/* результат: один кейс */}
      {state === "done" && single && (
        <div
          className="flex flex-wrap items-center gap-4 border-b border-line p-4"
          style={{ boxShadow: `inset 4px 0 0 ${rarityColor(single.item.rarity)}` }}
        >
          <SkinImage src={single.item.image} name={single.item.name} className="h-20 w-28" />
          <div className="min-w-0 flex-1">
            <div className="text-xs" style={{ color: rarityColor(single.item.rarity) }}>
              {rarityLabel(single.item.rarity)}
            </div>
            <div className="font-display text-xl leading-tight">{single.item.name}</div>
            {single.troll && <div className="text-sm text-dust">Почти. Топ уехал.</div>}
            <div className="text-sm text-dust">Цена: {money(single.item.price)}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {unsold.length ? (
              <>
                <button onClick={() => sell([single.inventoryId])} disabled={selling} className="btn-ghost">
                  Продать за {money(sellFor(single))}
                </button>
                <button onClick={() => setState("idle")} className="btn-ghost">
                  Оставить в инвентаре
                </button>
              </>
            ) : (
              <span className="text-sm text-ok">Продано за {money(soldTotal)}</span>
            )}
          </div>
        </div>
      )}

      {/* результат: несколько кейсов */}
      {state === "done" && drops.length > 1 && (
        <div className="space-y-3 border-b border-line p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-dust">
              Выпало {drops.length} шт. на <span className="text-bone">{money(wonTotal)}</span>
              {soldTotal > 0 && <span className="text-ok"> · продано на {money(soldTotal)}</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {unsold.length > 0 && (
                <button onClick={() => sell(unsold.map((d) => d.inventoryId))} disabled={selling} className="btn-ghost">
                  {unsold.length === drops.length ? "Продать всё" : "Продать остальное"} за {money(unsoldTotal)}
                </button>
              )}
              <button onClick={() => setState("idle")} className="btn-ghost">
                {unsold.length > 0 ? "Оставить в инвентаре" : "Закрыть"}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {drops.map((d) => {
              const isSold = soldIds.includes(d.inventoryId);
              return (
                <ItemCard
                  key={d.inventoryId}
                  name={d.item.name}
                  rarity={d.item.rarity}
                  image={d.item.image}
                  wear={d.item.wear}
                  price={d.item.price}
                  footer={
                    isSold ? (
                      <span className="text-xs text-ok">Продано</span>
                    ) : (
                      <button
                        onClick={() => sell([d.inventoryId])}
                        disabled={selling}
                        className="btn-ghost h-8 w-full px-2 text-xs"
                      >
                        Продать за {money(sellFor(d))}
                      </button>
                    )
                  }
                />
              );
            })}
          </div>
        </div>
      )}

      {/* управление */}
      <div className="flex flex-wrap items-center gap-4 p-4">
        {loggedIn ? (
          <>
            <div className="flex items-center gap-1" role="group" aria-label="Сколько кейсов открыть">
              {Array.from({ length: MAX_COUNT }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => pickCount(n)}
                  disabled={busy}
                  aria-pressed={count === n}
                  className={`h-11 w-10 rounded border text-sm font-semibold disabled:opacity-50 ${
                    count === n ? "border-stencil bg-stencil text-ground" : "border-line text-dust hover:text-bone"
                  }`}
                >
                  ×{n}
                </button>
              ))}
            </div>
            <button onClick={open} disabled={!canOpen} className="btn-primary h-11 px-6 text-base">
              {busy
                ? "Крутится…"
                : `Открыть ${state === "done" ? "ещё " : ""}${count > 1 ? `${count} шт. ` : ""}за ${money(cost)}`}
            </button>
          </>
        ) : (
          <a href="/api/auth/steam/login" className="btn-primary h-11 px-6 text-base">
            Войти через Steam, чтобы открыть
          </a>
        )}
        <label className="flex cursor-pointer items-center gap-2 text-sm text-dust">
          <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} className="accent-stencil" />
          Без анимации
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-dust">
          <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} className="accent-stencil" />
          Звук
        </label>
        {loggedIn && (
          <span className="ml-auto text-sm text-dust">
            На балансе: <span className="text-bone">{money(money_)}</span>
          </span>
        )}
        {banned && <p className="w-full text-sm text-danger">Аккаунт заблокирован администратором.</p>}
        {loggedIn && !banned && money_ < cost && !busy && (
          <p className="w-full text-sm text-dust">
            Не хватает {money(cost - money_)}.{" "}
            <a href="/balance" className="text-stencil underline-offset-2 hover:underline">
              Пополнить баланс
            </a>
          </p>
        )}
        {error && <p className="w-full text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { rarityColor, rarityLabel } from "@/lib/rarity";
import { money } from "@/lib/format";
import SkinImage from "./SkinImage";
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

type Won = { inventoryId: string; item: Omit<Item, "chance"> };

const CARD = 148; // ширина карточки в ленте
const GAP = 6;
const STEP = CARD + GAP;
const LENGTH = 64;
const WIN_INDEX = 56;
const SPIN_MS = 6500;

// Лента только для красоты: победитель уже выбран сервером
function buildStrip(items: Item[], winner: Omit<Item, "chance">, decoy?: Omit<Item, "chance"> | null) {
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
  const viewport = useRef<HTMLDivElement>(null);
  const [strip, setStrip] = useState<Item[]>(() =>
    // стартовая лента без случайности, чтобы сервер и браузер нарисовали одно и то же
    items.length ? Array.from({ length: 12 }, (_, i) => items[i % items.length]) : [],
  );
  const [offset, setOffset] = useState(0);
  const [animate, setAnimate] = useState(false);
  const [state, setState] = useState<"idle" | "spinning" | "done">("idle");
  const [won, setWon] = useState<Won | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fast, setFast] = useState(false);
  const [sold, setSold] = useState<number | null>(null);
  const [money_, setMoney] = useState(balance);
  const [sound, setSound] = useState(true);
  const [duration, setDuration] = useState(SPIN_MS);
  const [trolled, setTrolled] = useState(false);

  const canOpen = loggedIn && !banned && money_ >= price && state !== "spinning" && items.length > 0;

  async function open() {
    setError(null);
    setSold(null);
    setState("spinning");
    const res = await fetch(`/api/cases/${caseId}/open`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Не получилось открыть кейс");
      setState("idle");
      return;
    }
    const result: Won = { inventoryId: data.inventoryId, item: data.item };
    setMoney(data.balance);

    if (fast) {
      setWon(result);
      setState("done");
      router.refresh();
      return;
    }

    const decoy = data.troll as Won["item"] | null;
    const next = buildStrip(items, result.item, decoy);
    setAnimate(false);
    setOffset(0);
    setStrip(next);
    setWon(null);
    setTrolled(false);
    const w = viewport.current?.clientWidth ?? 800;
    const centerOn = (index: number, jitter: number) => -(index * STEP + CARD / 2 - w / 2 + jitter);

    const finish = () => {
      setWon(result);
      setState("done");
      router.refresh();
    };

    // ждём, пока лента перерисуется в начальной позиции, затем крутим
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setDuration(SPIN_MS);
        setAnimate(true);
        setOffset(centerOn(WIN_INDEX, decoy ? (Math.random() - 0.5) * CARD * 0.3 : (Math.random() - 0.5) * CARD * 0.7));
      }),
    );

    if (!decoy) {
      setTimeout(finish, SPIN_MS + 150);
      return;
    }
    // Пук-прокрутка: замерли на топе… пук… доезжаем до настоящего предмета
    setTimeout(() => {
      if (sound) playFart();
      setTrolled(true);
      setDuration(1100);
      setOffset(centerOn(WIN_INDEX + 1, (Math.random() - 0.5) * CARD * 0.4));
      setTimeout(finish, 1250);
    }, SPIN_MS + 1200);
  }

  async function sell() {
    if (!won) return;
    const res = await fetch("/api/inventory/sell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [won.inventoryId] }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error ?? "Не получилось продать");
    setSold(data.total);
    setMoney(data.balance);
    router.refresh();
  }

  const sellFor = won ? Math.round(won.item.price * (1 - sellCommission / 100) * 100) / 100 : 0;

  return (
    <div className="panel overflow-hidden">
      {/* лента */}
      <div ref={viewport} className="relative h-[176px] overflow-hidden border-b border-line bg-ground">
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
              className="flex h-[148px] shrink-0 flex-col rounded border border-line bg-panel"
              style={{ width: CARD }}
            >
              <div className="flex-1 p-2">
                <SkinImage src={it.image} name={it.name} className="h-full w-full" />
              </div>
              <div className="h-[3px]" style={{ background: rarityColor(it.rarity) }} />
              <div className="truncate px-2 py-1.5 text-xs text-dust">{it.name}</div>
            </div>
          ))}
        </div>
        {/* указатель */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-stencil" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[9px] border-x-transparent border-t-stencil" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[7px] border-b-[9px] border-x-transparent border-b-stencil" />
      </div>

      {/* результат */}
      {state === "done" && won && (
        <div
          className="flex flex-wrap items-center gap-4 border-b border-line p-4"
          style={{ boxShadow: `inset 4px 0 0 ${rarityColor(won.item.rarity)}` }}
        >
          <SkinImage src={won.item.image} name={won.item.name} className="h-20 w-28" />
          <div className="min-w-0 flex-1">
            <div className="text-xs" style={{ color: rarityColor(won.item.rarity) }}>
              {rarityLabel(won.item.rarity)}
            </div>
            <div className="font-display text-xl leading-tight">{won.item.name}</div>
            {trolled && <div className="text-sm text-dust">Почти. Топ уехал.</div>}
            <div className="text-sm text-dust">Цена: {money(won.item.price)}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {sold == null ? (
              <>
                <button onClick={sell} className="btn-ghost">
                  Продать за {money(sellFor)}
                </button>
                <button onClick={() => setState("idle")} className="btn-ghost">
                  Оставить в инвентаре
                </button>
              </>
            ) : (
              <span className="text-sm text-ok">Продано за {money(sold)}</span>
            )}
          </div>
        </div>
      )}

      {/* управление */}
      <div className="flex flex-wrap items-center gap-4 p-4">
        {loggedIn ? (
          <button onClick={open} disabled={!canOpen} className="btn-primary h-11 px-6 text-base">
            {state === "spinning" ? "Крутится…" : state === "done" ? `Открыть ещё за ${money(price)}` : `Открыть за ${money(price)}`}
          </button>
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
        {loggedIn && !banned && money_ < price && state !== "spinning" && (
          <p className="w-full text-sm text-dust">
            Не хватает {money(price - money_)}.{" "}
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

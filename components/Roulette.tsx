"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ItemCard, { ItemData, rarityOf } from "@/components/ItemCard";
import { Button } from "@/components/ui/button";

export type RouletteItem = ItemData & { dropChance: number };
type WonItem = ItemData & { id: string };

const CARD_W = 140; // ширина карточки в ленте
const GAP = 8; // промежуток между карточками
const STEP = CARD_W + GAP;
const REEL_LEN = 60; // сколько карточек в ленте
const WIN_INDEX = 50; // на какой по счёту карточке останавливаемся
const SPIN_MS = 6000; // длительность прокрутки

// Лента в покое: без случайности, чтобы страница не "прыгала" при загрузке
function idleReel(items: RouletteItem[]): ItemData[] {
  return Array.from({ length: 24 }, (_, i) => items[i % items.length]);
}

// Только для красоты: случайные соседи с учётом шансов.
// Настоящий выигрыш выбирается на сервере
function randomFiller(items: RouletteItem[]): ItemData {
  const total = items.reduce((s, i) => s + i.dropChance, 0);
  let roll = Math.random() * total;
  for (const it of items) {
    roll -= it.dropChance;
    if (roll <= 0) return it;
  }
  return items[items.length - 1];
}

function buildReel(items: RouletteItem[], won: WonItem): ItemData[] {
  const reel = Array.from({ length: REEL_LEN }, () => randomFiller(items));
  reel[WIN_INDEX] = won;
  return reel;
}

export default function Roulette({
  caseId,
  price,
  items,
  loggedIn,
}: {
  caseId: string;
  price: number;
  items: RouletteItem[];
  loggedIn: boolean;
}) {
  const router = useRouter();
  const viewportRef = useRef<HTMLDivElement>(null);
  const finishedRef = useRef(true);
  const pendingRef = useRef<WonItem | null>(null);

  const [reel, setReel] = useState<ItemData[]>(() => idleReel(items));
  const [x, setX] = useState(0);
  const [animate, setAnimate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [won, setWon] = useState<WonItem | null>(null);

  // Прокрутка закончилась: показываем результат и обновляем баланс в шапке
  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setWon(pendingRef.current);
    setBusy(false);
    router.refresh();
  }

  async function open() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setWon(null);

    let data: { item?: WonItem; error?: string } = {};
    try {
      const res = await fetch(`/api/cases/${caseId}/open`, { method: "POST" });
      data = await res.json();
      if (!res.ok || !data.item) {
        throw new Error(data.error ?? "Не удалось открыть кейс");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сети");
      setBusy(false);
      return;
    }

    const prize = data.item;
    pendingRef.current = prize;
    finishedRef.current = false;

    // Сброс ленты в начало без анимации
    setAnimate(false);
    setX(0);
    setReel(buildReel(items, prize));

    // Остановка на выигрышной карточке с небольшим случайным смещением
    const vw = viewportRef.current?.clientWidth ?? 600;
    const jitter = (Math.random() - 0.5) * (CARD_W - 24);
    const target = WIN_INDEX * STEP + CARD_W / 2 + jitter - vw / 2;

    // Ждём два кадра, чтобы сброс успел отрисоваться, и запускаем прокрутку
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setAnimate(true);
        setX(-target);
      })
    );

    // Запасной таймер, если событие окончания анимации не придёт
    window.setTimeout(finish, SPIN_MS + 400);
  }

  return (
    <div className="space-y-4">
      <div
        ref={viewportRef}
        className="relative overflow-hidden rounded-xl border border-border bg-card py-4"
      >
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-0.5 -translate-x-1/2 bg-violet-400 shadow-[0_0_12px_2px_rgba(167,139,250,0.9)]" />
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-card to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-card to-transparent" />

        <div
          className="flex will-change-transform"
          style={{
            gap: GAP,
            transform: `translateX(${x}px)`,
            transition: animate
              ? `transform ${SPIN_MS}ms cubic-bezier(0.1, 0.7, 0.1, 1)`
              : "none",
          }}
          onTransitionEnd={(e) => {
            if (e.propertyName === "transform") finish();
          }}
        >
          {reel.map((it, i) => (
            <div key={i} className="shrink-0" style={{ width: CARD_W, height: 150 }}>
              <ItemCard item={it} compact />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        {loggedIn ? (
          <Button
            size="lg"
            disabled={busy}
            onClick={open}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500"
          >
            {busy ? "Открываем..." : `Открыть за ${price.toLocaleString("ru-RU")} ₽`}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Войди через Steam, чтобы открывать кейсы
          </p>
        )}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </div>

      {won ? (
        <div
          className={`mx-auto w-full max-w-sm rounded-xl border bg-card p-4 text-center ${rarityOf(won.rarity).border}`}
        >
          <p className="mb-2 text-sm text-muted-foreground">Тебе выпало</p>
          <div className="mx-auto h-44 w-40">
            <ItemCard item={won} />
          </div>
          <p className={`mt-3 font-semibold ${rarityOf(won.rarity).text}`}>
            {rarityOf(won.rarity).label}
          </p>
          <p className="text-sm text-muted-foreground">Скин добавлен в инвентарь</p>
        </div>
      ) : null}
    </div>
  );
}

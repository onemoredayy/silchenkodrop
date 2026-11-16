"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { rarityColor, rarityLabel } from "@/lib/rarity";
import { money } from "@/lib/format";
import SkinImage from "./SkinImage";
import ItemCard from "./ItemCard";
import { playFart } from "@/lib/fart";
import { playBaraban, playGold, primeBaraban, stopBaraban } from "@/lib/baraban";
import { jackpot, lose, readX, unlockAudio, setSoundOn, soundOn, tickWhileMoving, win } from "@/lib/sfx";
import Fireworks from "./Fireworks";

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
type Drop = { inventoryId: string; item: Base; troll: Base | null; gold?: boolean; bonus?: { inventoryId: string; item: Base }[] };

const MAX_COUNT = 5;
const GAP = 6;
const LENGTH = 64;
const WIN_INDEX = 56;
const SPIN_MS = 6500;
const TOP_SPIN_MS = 9000; // топ-дроп крутится дольше, под барабан
const GOLD_SPIN_MS = 7000; // Голда: интро + лента ≈ длине её музыки (9,5 с)
const INTRO_MS = 1100; // иконка кейса раскручивается и улетает перед лентой
const GOLD_INTRO_MS = 2500;
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
  ticking,
  top,
  gold,
}: {
  items: Item[];
  drop: Drop | null;
  run: number;
  compact: boolean;
  onFart: () => void;
  ticking: boolean; // щёлкает только одна лента, иначе при ×5 будет каша
  top: boolean; // выпал топ-дроп — карточка сияет
  gold: boolean; // выпала Голда — лента сходит с ума
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const tickRef = useRef(ticking);
  tickRef.current = ticking;
  // ширина карточки в ленте; на телефоне меньше, чтобы было видно соседей
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const card = compact ? (narrow ? 84 : 112) : narrow ? 112 : 148;
  const cardH = compact ? (narrow ? 76 : 104) : narrow ? 116 : 148;
  const step = card + GAP;
  const viewport = useRef<HTMLDivElement>(null);
  const fart = useRef(onFart);
  fart.current = onFart;
  const topRef = useRef(top);
  topRef.current = top;
  const goldRef = useRef(gold);
  goldRef.current = gold;
  const [strip, setStrip] = useState<Item[]>(() =>
    // стартовая лента без случайности, чтобы сервер и браузер нарисовали одно и то же
    items.length ? Array.from({ length: 12 }, (_, i) => items[i % items.length]) : [],
  );
  const [offset, setOffset] = useState(0);
  const [animate, setAnimate] = useState(false);
  const [duration, setDuration] = useState(SPIN_MS);
  const [live, setLive] = useState(false); // лента сейчас крутится
  const [landed, setLanded] = useState<{ index: number; top: boolean } | null>(null);
  // где лента остановилась: индекс и смещение в долях карточки — чтобы пересчитать при смене размера
  const target = useRef<{ index: number; jitter: number } | null>(null);
  // Лента крутится только при НОВОМ запуске. Раньше лента, появившаяся при выборе ×2…×5,
  // видела старый номер запуска и старый дроп и начинала крутиться сама.
  const seenRun = useRef(run);

  const centerOn = (index: number, jitter: number) => {
    const w = viewport.current?.clientWidth ?? 800;
    return -(index * step + card / 2 - w / 2 + jitter * card);
  };

  // сменился размер карточек (×1 ↔ ×N, поворот телефона) — ставим ленту туда же, без анимации
  useEffect(() => {
    if (live) return;
    setAnimate(false);
    setOffset(target.current ? centerOn(target.current.index, target.current.jitter) : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card]);

  useEffect(() => {
    if (run === seenRun.current) return;
    seenRun.current = run;
    if (!drop) return;
    const decoy = drop.troll;
    setAnimate(false);
    setOffset(0);
    setLanded(null);
    setLive(true);
    setStrip(buildStrip(items, drop.item, decoy));
    const timers: ReturnType<typeof setTimeout>[] = [];
    const ms = goldRef.current ? GOLD_SPIN_MS : topRef.current && !decoy ? TOP_SPIN_MS : SPIN_MS;

    let stopTicks = () => {};
    // ждём, пока лента перерисуется в начальной позиции, затем крутим
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        setDuration(ms);
        setAnimate(true);
        const jitter = (Math.random() - 0.5) * (decoy ? 0.3 : 0.7);
        target.current = { index: WIN_INDEX, jitter };
        setOffset(centerOn(WIN_INDEX, jitter));
        // щелчок на каждой карточке, проходящей под стрелкой
        if (tickRef.current && stripRef.current) {
          stopTicks = tickWhileMoving(stripRef.current, readX, step, ms + (decoy ? TROLL_PAUSE_MS + TROLL_MOVE_MS : 0) + 100);
        }
      });
    });
    // остановились: карточка под стрелкой выпрыгивает, топ — сияет
    timers.push(
      setTimeout(() => {
        setLive(false);
        setLanded({ index: WIN_INDEX, top: decoy ? true : topRef.current });
      }, ms),
    );
    if (decoy) {
      // Пук-прокрутка: замерли на сияющем топе… пук… доезжаем до настоящего предмета
      timers.push(
        setTimeout(() => {
          fart.current();
          setLanded(null);
          setDuration(TROLL_MOVE_MS);
          const jitter = (Math.random() - 0.5) * 0.4;
          target.current = { index: WIN_INDEX + 1, jitter };
          setOffset(centerOn(WIN_INDEX + 1, jitter));
        }, SPIN_MS + TROLL_PAUSE_MS),
        setTimeout(() => setLanded({ index: WIN_INDEX + 1, top: false }), SPIN_MS + TROLL_PAUSE_MS + TROLL_MOVE_MS),
      );
    }
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      stopTicks();
      setLive(false);
    };
    // лента перезапускается только по номеру запуска
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  return (
    <div
      ref={viewport}
      className={`relative overflow-hidden border-b border-line bg-ground ${landed?.top ? "reel-flash" : ""} ${gold && (live || landed) ? "reel-gold" : ""}`}
      style={{
        height: cardH + 28,
        // края ленты плавно уходят в тень
        maskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
        WebkitMaskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
      }}
    >
      <div
        ref={stripRef}
        className="flex h-full items-center"
        style={{
          gap: GAP,
          transform: `translateX(${offset}px)`,
          transition: animate
            ? `transform ${duration}ms ${duration >= SPIN_MS ? "cubic-bezier(0.08, 0.6, 0.12, 1)" : "cubic-bezier(0.5, 0, 0.3, 1)"}`
            : "none",
        }}
      >
        {strip.map((it, i) => (
          <div
            key={i}
            className={`relative flex shrink-0 flex-col rounded border border-line bg-panel transition-opacity duration-300 ${gold && live ? "reel-gold-card" : ""} ${
              landed?.index === i ? (landed.top ? "reel-jackpot" : "reel-win") : landed ? "opacity-40" : ""
            }`}
            style={{
              width: card,
              height: cardH,
              ...(landed?.index === i && !landed.top ? { boxShadow: `0 0 18px 2px ${rarityColor(it.rarity)}` } : {}),
            }}
          >
            <div className="min-h-0 flex-1 p-2">
              <SkinImage src={it.image} name={it.name} className="h-full w-full" />
            </div>
            <div className="h-[3px]" style={{ background: rarityColor(it.rarity) }} />
            <div className={`truncate px-1.5 text-dust ${compact ? "py-0.5 text-[10px] sm:py-1 sm:text-xs" : "py-1 text-[11px] sm:py-1.5 sm:text-xs"}`}>
              {it.name}
            </div>
          </div>
        ))}
      </div>
      {/* указатель */}
      <div className={`pointer-events-none absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-stencil ${live ? "reel-pointer-live" : ""}`} />
      <div className="pointer-events-none absolute left-1/2 top-0 h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[9px] border-x-transparent border-t-stencil" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[7px] border-b-[9px] border-x-transparent border-b-stencil" />
    </div>
  );
}

export default function CaseOpener({
  caseId,
  caseImage,
  caseName,
  price,
  items,
  loggedIn,
  balance,
  banned,
  sellCommission,
}: {
  caseId: string;
  caseImage: string | null;
  caseName: string;
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
  useEffect(() => setSound(soundOn()), []);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const farted = useRef(false);
  const finishTimer = useRef<ReturnType<typeof setTimeout>>();
  const [fire, setFire] = useState(0); // номер салюта
  const [banner, setBanner] = useState<(Base & { gold?: number }) | null>(null);
  // иконка кейса до ленты: idle — просто светится, normal/gold — раскручивается и улетает
  const [intro, setIntro] = useState<"idle" | "normal" | "gold" | null>("idle");
  const maxPrice = Math.max(0, ...items.map((i) => i.price));
  // топ-дроп: самый дорогой предмет кейса или в 10+ раз дороже кейса (подстава пук-прокрутки — не топ)
  const isTop = (d: Drop) => !d.troll && d.item.price > 0 && (d.item.price >= maxPrice * 0.999 || d.item.price >= price * 10);

  useEffect(
    () => () => {
      clearTimeout(finishTimer.current);
      stopBaraban();
    },
    [],
  );

  const cost = Math.round(price * count * 100) / 100;
  const busy = state === "spinning";
  const canOpen = loggedIn && !banned && money_ >= cost && !busy && items.length > 0;

  function pickCount(n: number) {
    if (busy) return;
    setCount(n);
    setReels(n);
    if (state !== "done") setIntro("idle");
  }

  async function open() {
    unlockAudio();
    if (soundRef.current) primeBaraban(); // разрешаем браузеру сыграть барабан позже, после ответа сервера
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
    const anyGold = got.some((d) => d.gold);

    const finish = () => {
      stopBaraban();
      setState("done");
      const best = got.filter(isTop).sort((a, b) => b.item.price - a.item.price)[0];
      if (best) {
        setFire((f) => f + 1);
        setBanner({ ...best.item, gold: best.gold ? best.bonus?.length ?? 0 : undefined });
        setTimeout(() => setBanner(null), best.gold ? 4500 : 3300);
        if (soundRef.current) jackpot();
        return router.refresh();
      }
      // итоговый звук: выпало дороже, чем потрачено, — победный, иначе глухой
      const gotSum = got.reduce((acc, d) => acc + d.item.price, 0);
      if (soundRef.current) (gotSum >= price * got.length ? win : lose)();
      router.refresh();
    };
    if (fast) {
      setIntro(null);
      setReels(got.length);
      return finish();
    }

    farted.current = false;
    const anyTroll = got.some((d) => d.troll);
    const anyTop = got.some(isTop);
    // 1) иконка кейса раскручивается и улетает (Голда — бешено, под свою музыку)
    const introMs = anyGold ? GOLD_INTRO_MS : INTRO_MS;
    setIntro(anyGold ? "gold" : "normal");
    if (soundRef.current) {
      if (anyGold) playGold();
      else if (anyTop) playBaraban();
    }
    // 2) появляются ленты, на следующем кадре — крутятся
    finishTimer.current = setTimeout(() => {
      setIntro(null);
      setReels(got.length);
      finishTimer.current = setTimeout(() => {
        setRun((r) => r + 1);
        finishTimer.current = setTimeout(
          finish,
          Math.max(
            anyTroll ? SPIN_MS + TROLL_PAUSE_MS + TROLL_MOVE_MS : 0,
            anyGold ? GOLD_SPIN_MS : anyTop ? TOP_SPIN_MS : SPIN_MS,
          ) + 150,
        );
      }, 40);
    }, introMs);
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
  // Голда раскладывается на все скины кейса — их и показываем в итогах
  const results: Drop[] = drops.flatMap((d) => (d.gold && d.bonus ? d.bonus.map((b) => ({ ...b, troll: null })) : [d]));
  const unsold = results.filter((d) => !soldIds.includes(d.inventoryId));
  const unsoldTotal = Math.round(unsold.reduce((s, d) => s + sellFor(d), 0) * 100) / 100;
  const wonTotal = Math.round(results.reduce((s, d) => s + d.item.price, 0) * 100) / 100;
  const single = results.length === 1 ? results[0] : null;

  return (
    <div className="panel overflow-hidden">
      <Fireworks fire={fire} />
      {banner && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
          <div key={fire} className="jackpot-banner text-center">
            <div
              className="font-display text-5xl sm:text-7xl"
              style={{ color: "#ffe08a", textShadow: "0 0 18px #e0b43a, 0 0 40px #ff5fd2, 0 4px 0 #171a16" }}
            >
              {banner.gold != null ? "ГОЛДА!!!" : "ТОП ДРОП!"}
            </div>
            <div className="mt-2 inline-block rounded bg-ground/80 px-3 py-1 text-base sm:text-lg">
              {banner.gold != null ? `Весь кейс твой: ${banner.gold} скинов` : banner.name} ·{" "}
              <span className="text-stencil">{money(banner.price)}</span>
            </div>
          </div>
        </div>
      )}
      {/* иконка кейса: светится, а при открытии раскручивается и улетает — потом ленты */}
      {intro && (
        <div
          className={`relative grid h-56 place-items-center overflow-hidden border-b border-line bg-ground sm:h-64 ${intro === "gold" ? "case-hero-gold-bg" : ""}`}
        >
          <div
            className="pointer-events-none absolute h-56 w-56 rounded-full opacity-50 blur-2xl"
            style={{ background: intro === "gold" ? "#ffd54a" : "#e0b43a55" }}
          />
          <div
            key={intro}
            className={intro === "idle" ? "case-hero-idle" : intro === "gold" ? "case-hero-gold" : "case-hero-go"}
            style={{ ["--intro-ms" as string]: `${intro === "gold" ? GOLD_INTRO_MS : INTRO_MS}ms` }}
          >
            <SkinImage src={caseImage} name={caseName} className="h-40 w-52 sm:h-48 sm:w-64" />
          </div>
        </div>
      )}
      {/* ленты: по одной на каждый кейс */}
      {!intro && Array.from({ length: reels }, (_, i) => (
        <Reel
          key={i}
          items={items}
          drop={drops[i] ?? null}
          run={run}
          compact={reels > 1}
          onFart={fartOnce}
          ticking={i === 0 && sound}
          top={!!drops[i] && isTop(drops[i])}
          gold={!!drops[i]?.gold}
        />
      ))}

      {/* результат: один кейс */}
      {state === "done" && single && (
        <div
          className="flex flex-wrap items-center gap-3 border-b border-line p-3 sm:gap-4 sm:p-4"
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
      {state === "done" && results.length > 1 && (
        <div className="space-y-3 border-b border-line p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-dust">
              {drops.some((d) => d.gold) && <span className="mr-1 font-semibold text-stencil">ГОЛДА — весь кейс твой!</span>}
              Выпало {results.length} шт. на <span className="text-bone">{money(wonTotal)}</span>
              {soldTotal > 0 && <span className="text-ok"> · продано на {money(soldTotal)}</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {unsold.length > 0 && (
                <button onClick={() => sell(unsold.map((d) => d.inventoryId))} disabled={selling} className="btn-ghost">
                  {unsold.length === results.length ? "Продать всё" : "Продать остальное"} за {money(unsoldTotal)}
                </button>
              )}
              <button onClick={() => setState("idle")} className="btn-ghost">
                {unsold.length > 0 ? "Оставить в инвентаре" : "Закрыть"}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:grid-cols-6">
            {results.map((d) => {
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
                        className="btn-ghost h-8 w-full px-1 text-[11px]"
                      >
                        Продать
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
      <div className="flex flex-wrap items-center gap-3 p-3 sm:gap-4 sm:p-4">
        {loggedIn ? (
          <>
            <div className="flex w-full items-center gap-1 sm:w-auto" role="group" aria-label="Сколько кейсов открыть">
              {Array.from({ length: MAX_COUNT }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => pickCount(n)}
                  disabled={busy}
                  aria-pressed={count === n}
                  className={`h-11 flex-1 rounded border text-sm font-semibold disabled:opacity-50 sm:w-10 sm:flex-none ${
                    count === n ? "border-stencil bg-stencil text-ground" : "border-line text-dust hover:text-bone"
                  }`}
                >
                  ×{n}
                </button>
              ))}
            </div>
            <button onClick={open} disabled={!canOpen} className="btn-primary h-12 w-full px-6 text-base sm:h-11 sm:w-auto">
              {busy
                ? "Крутится…"
                : `Открыть ${state === "done" ? "ещё " : ""}${count > 1 ? `${count} шт. ` : ""}за ${money(cost)}`}
            </button>
          </>
        ) : (
          <a href="/api/auth/steam/login" className="btn-primary h-12 w-full px-6 text-base sm:h-11 sm:w-auto">
            Войти через Steam, чтобы открыть
          </a>
        )}
        <label className="flex cursor-pointer items-center gap-2 text-sm text-dust">
          <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} className="accent-stencil" />
          Без анимации
        </label>
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
        {loggedIn && (
          <span className="text-sm text-dust sm:ml-auto">
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

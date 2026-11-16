"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { rarityColor } from "@/lib/rarity";
import { money } from "@/lib/format";
import { upgradeChance } from "@/lib/upgrade";
import SkinImage from "./SkinImage";
import ItemCard from "./ItemCard";
import { lose, magnetHum, setSoundOn, soundOn, tick, unlockAudio, win } from "@/lib/sfx";
import Pager from "./Pager";

type Inv = { id: string; name: string; rarity: string; image: string | null; wear: string | null; price: number };
type Target = { marketHashName: string; name: string; rarity: string; image: string | null; wear: string | null; price: number };

const MULTS = [1.5, 2, 3, 5, 10];
const SPIN_MS = 4500; // основная прокрутка
const TEASE_MS = 750; // «азартная»: стрелка дрожит, будто вот-вот выиграл
const PULL_MS = 1500; // «азартная»: магнит утаскивает стрелку в красное
const GAMBLE_KEY = "upgradeGamble";
const GHOSTS = 4; // шлейф за стрелкой на скорости

const easeOut = (p: number) => 1 - Math.pow(1 - p, 4);
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Phase = "idle" | "spin" | "tease" | "magnet" | "done";
const PER_PAGE = 9; // 3 ряда по 3 карточки — и в инвентаре, и в целях

export default function Upgrader({ inventory, edge, maxChance }: { inventory: Inv[]; edge: number; maxChance: number }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [stOnly, setStOnly] = useState("");
  const [targets, setTargets] = useState<Target[]>([]);
  const [targetPage, setTargetPage] = useState(1);
  const [targetPages, setTargetPages] = useState(1);
  const [invPage, setInvPage] = useState(1);
  const [target, setTarget] = useState<Target | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [magnetDeg, setMagnetDeg] = useState(0);
  const [gamble, setGamble] = useState(false);
  const arrowRef = useRef<SVGGElement>(null);
  const ghostRefs = useRef<(SVGGElement | null)[]>([]);
  const angleRef = useRef(0);
  const trail = useRef<number[]>([]);
  const raf = useRef(0);
  const [sound, setSound] = useState(true);
  useEffect(() => {
    setSound(soundOn());
    try {
      setGamble(localStorage.getItem(GAMBLE_KEY) === "on");
    } catch {}
    return () => cancelAnimationFrame(raf.current);
  }, []);
  const [result, setResult] = useState<null | { success: boolean }>(null);
  const [error, setError] = useState<string | null>(null);

  const value = useMemo(
    () => Math.round(inventory.filter((i) => picked.includes(i.id)).reduce((s, i) => s + i.price, 0) * 100) / 100,
    [picked, inventory],
  );
  const chance = target ? upgradeChance(value, target.price, edge, maxChance) : 0;

  // страницы инвентаря; после апгрейда предметов становится меньше — не остаёмся на пустой странице
  const invPages = Math.max(1, Math.ceil(inventory.length / PER_PAGE));
  const invShown = inventory.slice((Math.min(invPage, invPages) - 1) * PER_PAGE, Math.min(invPage, invPages) * PER_PAGE);
  useEffect(() => {
    if (invPage > invPages) setInvPage(invPages);
  }, [invPage, invPages]);

  // сменилась ставка или фильтр — список целей начинается с первой страницы
  useEffect(() => setTargetPage(1), [value, q, stOnly]);

  // подгружаем цели дороже ставки
  useEffect(() => {
    let stale = false;
    const t = setTimeout(async () => {
      const p = new URLSearchParams({ min: String(value), q, st: stOnly, page: String(targetPage) });
      const res = await fetch(`/api/catalog/targets?${p}`);
      if (!res.ok || stale) return;
      const data = await res.json();
      setTargets(data.rows ?? []);
      setTargetPages(data.pages ?? 1);
    }, 250);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [value, q, stOnly, targetPage]);

  useEffect(() => {
    if (target && target.price <= value) setTarget(null);
  }, [value, target]);

  function toggle(id: string) {
    if (spinning) return;
    setResult(null);
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 10 ? p : [...p, id]));
  }

  async function pickMult(m: number) {
    if (!value) return;
    const p = new URLSearchParams({ min: String(value * m), st: stOnly });
    const res = await fetch(`/api/catalog/targets?${p}`);
    if (!res.ok) return;
    const list: Target[] = (await res.json()).rows ?? [];
    if (list[0]) {
      setTarget(list[0]);
      setResult(null);
    }
  }

  // Стрелка двигается напрямую через DOM (без перерисовки React 60 раз в секунду)
  function draw(a: number) {
    angleRef.current = a;
    arrowRef.current?.setAttribute("transform", `rotate(${a} 110 110)`);
    trail.current.unshift(a);
    trail.current.length = Math.min(trail.current.length, GHOSTS * 3 + 1);
    ghostRefs.current.forEach((g, i) => {
      const h = trail.current[(i + 1) * 3] ?? a;
      g?.setAttribute("transform", `rotate(${h} 110 110)`);
    });
  }

  // Плавно ведёт стрелку от from до to; shake — дрожь в градусах; щелчок на каждые 15°
  function tween(from: number, to: number, ms: number, ease: (p: number) => number, shake = 0, ticks = true) {
    return new Promise<void>((done) => {
      const t0 = performance.now();
      let step = Math.floor(from / 15);
      const frame = (now: number) => {
        const p = Math.min(1, (now - t0) / ms);
        let a = from + (to - from) * ease(p);
        if (shake) a += Math.sin(now / 18) * shake * (1 - p * 0.6);
        draw(a);
        const st = Math.floor(a / 15);
        if (ticks && st !== step) {
          step = st;
          if (sound) tick();
        }
        if (p < 1) raf.current = requestAnimationFrame(frame);
        else {
          draw(to);
          done();
        }
      };
      raf.current = requestAnimationFrame(frame);
    });
  }

  function toggleGamble() {
    if (spinning) return;
    setGamble((g) => {
      try {
        localStorage.setItem(GAMBLE_KEY, g ? "off" : "on");
      } catch {}
      return !g;
    });
  }

  async function go() {
    unlockAudio();
    if (!target || !picked.length) return;
    setError(null);
    setResult(null);
    setSpinning(true);
    const res = await fetch("/api/upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inventoryIds: picked, target: target.marketHashName }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSpinning(false);
      return setError(data.error ?? "Ошибка");
    }

    // Итог определяет только бросок сервера: зелёная зона — [0, шанс), стрелка в конце
    // всегда стоит ровно на data.roll. «Азартный» режим меняет лишь путь стрелки.
    const roll: number = data.roll;
    const c = (data.chance ?? chance) / 100;
    const start = angleRef.current;
    const base = start - (start % 360) + 360 * 6;
    trail.current = [];

    setPhase("spin");
    if (!gamble) {
      await tween(start, base + roll * 360, SPIN_MS, easeOut);
    } else if (data.success) {
      await tween(start, base + roll * 360, SPIN_MS - 300, easeOut);
      setPhase("tease");
      await tween(angleRef.current, angleRef.current, TEASE_MS, (p) => p, 2.5, false);
    } else {
      // Останавливаемся в зелёном у ближайшего к броску края, потом магнит тянет к броску
      const eps = Math.min(0.025, c * 0.35);
      const forward = roll - c <= 1 - roll;
      const teaseAt = base + (forward ? c - eps : eps) * 360;
      const final = base + (forward ? roll : roll - 1) * 360;
      await tween(start, teaseAt, SPIN_MS - 300, easeOut);
      setMagnetDeg(roll * 360);
      setPhase("tease");
      await tween(teaseAt, teaseAt, TEASE_MS, (p) => p, 2.5, false);
      setPhase("magnet");
      if (sound) magnetHum(PULL_MS);
      await sleep(150);
      await tween(teaseAt, final, PULL_MS, easeInOut, 1.5);
    }

    setPhase("done");
    setSpinning(false);
    if (sound) (data.success ? win : lose)();
    setResult({ success: data.success });
    setPicked([]);
    router.refresh();
  }

  const R = 90;
  const C = 2 * Math.PI * R;

  return (
    <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_300px_1fr]">
      {/* ставка */}
      <section className="panel order-2 flex flex-col p-3 sm:p-4 lg:order-none lg:min-h-[420px]">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="font-medium">Твои скины</span>
          <span className="text-sm text-dust">
            {picked.length > 0 && `${picked.length} шт. · `}Ставка: {money(value)}
          </span>
        </div>
        {inventory.length === 0 ? (
          <p className="text-sm text-dust">Инвентарь пуст. Открой кейс, и сюда будет что поставить.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-3">
              {invShown.map((i) => (
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
            <Pager page={Math.min(invPage, invPages)} pages={invPages} onPage={setInvPage} className="mt-auto pt-3" />
          </>
        )}
      </section>

      {/* круг */}
      <section className="order-1 flex flex-col items-center justify-center gap-4 lg:order-none">
        <style>{`
          @keyframes up-pop { 0% { transform: scale(1) } 35% { transform: scale(1.12) } 100% { transform: scale(1) } }
          @keyframes up-shake { 0%,100% { transform: translateX(0) } 20% { transform: translateX(-7px) rotate(-2deg) } 40% { transform: translateX(6px) rotate(2deg) } 60% { transform: translateX(-4px) } 80% { transform: translateX(3px) } }
          @keyframes up-glow { 0%,100% { filter: drop-shadow(0 0 6px rgba(224,180,58,.35)) } 50% { filter: drop-shadow(0 0 18px rgba(224,180,58,.8)) } }
          @keyframes up-tease { 0%,100% { filter: drop-shadow(0 0 8px rgba(143,191,106,.5)) } 50% { filter: drop-shadow(0 0 22px rgba(143,191,106,1)) } }
          @keyframes up-magnet { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2px) } }
          @keyframes up-wave { 0% { opacity: 0; transform: translateY(-4px) } 50% { opacity: 1 } 100% { opacity: 0; transform: translateY(10px) } }
          .up-spin { animation: up-glow .5s ease-in-out infinite }
          .up-tease { animation: up-tease .25s ease-in-out infinite }
          .up-win { animation: up-pop .5s ease-out }
          .up-lose { animation: up-shake .45s ease-out }
        `}</style>
        <div
          key={result ? (result.success ? "w" : "l") + phase : phase}
          className={`relative mt-4 h-[180px] w-[180px] sm:h-[220px] sm:w-[220px] ${
            phase === "spin" ? "up-spin" : phase === "tease" || phase === "magnet" ? "up-tease" : result ? (result.success ? "up-win" : "up-lose") : ""
          }`}
        >
          <svg viewBox="0 0 220 220" className="h-full w-full overflow-visible">
            <g transform="rotate(-90 110 110)">
              <circle cx="110" cy="110" r={R} fill="none" stroke="#353b33" strokeWidth="14" />
              <circle
                cx="110"
                cy="110"
                r={R}
                fill="none"
                stroke={result ? (result.success ? "#8fbf6a" : "#e0614a") : phase === "tease" || phase === "magnet" ? "#8fbf6a" : "#e0b43a"}
                strokeWidth="14"
                strokeDasharray={`${(chance / 100) * C} ${C}`}
                style={{ transition: "stroke-dasharray 300ms, stroke 200ms" }}
              />
            </g>

            {/* шлейф стрелки — виден только на скорости */}
            {Array.from({ length: GHOSTS }, (_, i) => (
              <g
                key={i}
                ref={(el) => {
                  ghostRefs.current[i] = el;
                }}
                className="text-stencil"
                style={{ opacity: phase === "spin" ? 0.32 - i * 0.07 : 0, transition: "opacity 300ms" }}
              >
                <path d="M110 16 L121 40 L110 35 L99 40 Z" fill="currentColor" />
              </g>
            ))}

            {/* стрелка: наконечник у кольца, хвост с оперением ближе к центру */}
            <g ref={arrowRef} className={result ? (result.success ? "text-ok" : "text-danger") : "text-bone"}>
              <line x1="110" y1="36" x2="110" y2="74" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              <path d="M110 14 L123 40 L110 34 L97 40 Z" fill="currentColor" />
              <path d="M110 66 L102 78 M110 66 L118 78 M110 72 L102 84 M110 72 L118 84" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </g>

            {/* магнит — появляется только в «азартной» прокрутке при проигрыше */}
            <g transform={`rotate(${magnetDeg} 110 110)`} style={{ opacity: phase === "magnet" ? 1 : 0, transition: "opacity 250ms" }}>
              <g transform="translate(110 -10)">
                <g style={{ animation: phase === "magnet" ? "up-magnet .12s linear infinite" : "none" }}>
                  <path d="M-11 8 V0 A11 11 0 0 1 11 0 V8" fill="none" stroke="#e0614a" strokeWidth="7" />
                  <rect x="-14.5" y="7" width="7" height="7" fill="#cfd3d6" />
                  <rect x="7.5" y="7" width="7" height="7" fill="#cfd3d6" />
                </g>
                {[0, 1, 2].map((i) => (
                  <path
                    key={i}
                    d="M-9 20 Q0 26 9 20"
                    fill="none"
                    stroke="#e0614a"
                    strokeWidth="2"
                    strokeLinecap="round"
                    style={{ animation: phase === "magnet" ? `up-wave .6s ${i * 0.2}s linear infinite` : "none", opacity: 0 }}
                  />
                ))}
              </g>
            </g>
          </svg>
          <div className="pointer-events-none absolute inset-0 grid place-items-center pt-6 text-center">
            <div>
              <div className="font-display text-3xl">{chance ? `${chance}%` : "—"}</div>
              <div className="text-xs text-dust">
                {result
                  ? result.success
                    ? "Апгрейд удался"
                    : "Не повезло"
                  : phase === "tease"
                    ? "Есть?!"
                    : phase === "magnet"
                      ? "Магнит!"
                      : "шанс"}
              </div>
            </div>
          </div>
        </div>
        <button onClick={go} disabled={!target || !picked.length || spinning || chance < 0.5} className="btn-primary h-11 w-full text-base">
          {spinning ? "Крутится…" : "Апгрейд"}
        </button>
        <div className="flex flex-wrap justify-center gap-1">
          {MULTS.map((m) => (
            <button key={m} onClick={() => pickMult(m)} disabled={!value || spinning} className="btn-ghost h-10 px-3 text-sm sm:h-8 sm:text-xs">
              ×{m}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={toggleGamble}
          disabled={spinning}
          className={`flex h-10 w-full items-center justify-between rounded-card border px-3 text-sm transition-colors ${
            gamble ? "border-danger bg-danger/10 text-bone" : "border-line text-dust hover:bg-raised"
          }`}
        >
          <span>🧲 Азартная прокрутка</span>
          <span className={`relative h-5 w-9 rounded-full transition-colors ${gamble ? "bg-danger" : "bg-line"}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-bone transition-all ${gamble ? "left-[18px]" : "left-0.5"}`} />
          </span>
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
        {error && <p className="text-center text-sm text-danger">{error}</p>}
        {result?.success && <p className="text-center text-sm text-ok">Скин уже в инвентаре.</p>}
      </section>

      {/* цель */}
      <section className="panel order-3 flex flex-col p-3 sm:p-4 lg:order-none lg:min-h-[420px]">
        <div className="mb-3 font-medium">Цель</div>
        {target && (
          <div className="mb-3 flex items-center gap-3 rounded border border-stencil p-2" style={{ boxShadow: `inset 3px 0 0 ${rarityColor(target.rarity)}` }}>
            <SkinImage src={target.image} name={target.name} className="h-12 w-16" />
            <div className="min-w-0 flex-1 text-sm">
              <div className="truncate">{target.name}</div>
              <div className="text-dust">{money(target.price)}</div>
            </div>
          </div>
        )}
        <div className="mb-2 flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск" className="input h-10 sm:h-9" />
          <select value={stOnly} onChange={(e) => setStOnly(e.target.value)} className="input h-10 w-28 sm:h-9">
            <option value="">Все</option>
            <option value="0">Без ST</option>
            <option value="1">StatTrak</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-3">
          {targets.map((t) => (
            <ItemCard
              key={t.marketHashName}
              name={t.name}
              rarity={t.rarity}
              image={t.image}
              wear={t.wear}
              price={t.price}
              selected={target?.marketHashName === t.marketHashName}
              onClick={() => !spinning && (setTarget(t), setResult(null))}
            />
          ))}
        </div>
        {targets.length === 0 && <p className="text-sm text-dust">Ничего не нашлось.</p>}
        <Pager page={targetPage} pages={targetPages} onPage={setTargetPage} className="mt-auto pt-3" />
      </section>
    </div>
  );
}

"use client";

// Контракт как в старом CS:GO: бумажный договор, строки со скинами печатаются по одной,
// внизу — поле, где можно расписаться пальцем или мышкой. После подписи — печать,
// скины растворяются, и появляется результат.
import { useEffect, useRef, useState } from "react";
import { money } from "@/lib/format";
import { rarityColor, rarityLabel } from "@/lib/rarity";
import { tick, win, lose } from "@/lib/sfx";
import SkinImage from "./SkinImage";
import Fireworks from "./Fireworks";

type It = { id: string; name: string; rarity: string; image: string | null; price: number };
type Res = { value: number; item: { name: string; rarity: string; image: string | null; price: number } };
type Phase = "writing" | "sign" | "sending" | "stamp" | "dissolve" | "reveal";

const LINE_MS = 260; // пауза между строками договора
const PAPER = "#efe6cc";
const INK = "#2a2a3a";

export default function ContractSheet({
  items,
  value,
  sound,
  onSubmit,
  onClose,
}: {
  items: It[];
  value: number;
  sound: boolean;
  onSubmit: () => Promise<Res | null>; // null — ошибка, лист закрывается
  onClose: (done: boolean) => void;
}) {
  const [phase, setPhase] = useState<Phase>("writing");
  const [lines, setLines] = useState(0);
  const [signed, setSigned] = useState(false);
  const [res, setRes] = useState<Res | null>(null);
  const [fire, setFire] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // строки договора «печатаются» по одной, со стуком машинки
  useEffect(() => {
    if (phase !== "writing") return;
    if (lines >= items.length) {
      later(() => setPhase("sign"), 250);
      return;
    }
    later(() => {
      setLines((n) => n + 1);
      if (sound) tick(0.35);
    }, lines === 0 ? 350 : LINE_MS);
  }, [phase, lines, items.length, sound]);

  // холст подписи под размер и плотность экрана
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1d3fa0"; // синие чернила
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (phase !== "sign") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
    const ctx = e.currentTarget.getContext("2d")!;
    ctx.fillStyle = "#1d3fa0";
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2);
    ctx.fill();
    setSigned(true);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return;
    const p = pos(e);
    const ctx = e.currentTarget.getContext("2d")!;
    // чем быстрее ведёшь, тем тоньше линия — как перьевая ручка
    const d = Math.hypot(p.x - last.current.x, p.y - last.current.y);
    ctx.lineWidth = Math.max(1.2, 3.2 - d / 12);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  }
  const up = () => {
    drawing.current = false;
    last.current = null;
  };
  function clear() {
    const c = canvas.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    setSigned(false);
  }

  async function confirm() {
    setPhase("sending");
    const r = await onSubmit();
    if (!r) return onClose(false);
    setRes(r);
    setPhase("stamp");
    if (sound) tick(0.6);
    // печать → скины растворяются по одному → результат
    later(() => setPhase("dissolve"), 700);
    items.forEach((_, i) => later(() => sound && tick(0.2), 700 + i * 110));
    later(() => {
      setPhase("reveal");
      const good = r.item.price >= r.value;
      if (sound) (good ? win : lose)();
      if (r.item.price >= r.value * 3) setFire((f) => f + 1);
    }, 700 + items.length * 110 + 600);
  }

  const busy = phase === "sending" || phase === "stamp" || phase === "dissolve";
  const good = res ? res.item.price >= res.value : false;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm">
      <Fireworks fire={fire} ms={3500} />
      <style>{`
        @keyframes cs-paper-in { from { transform: translateY(40px) rotate(-2deg); opacity: 0 } to { transform: none; opacity: 1 } }
        @keyframes cs-line-in { from { clip-path: inset(0 100% 0 0) } to { clip-path: inset(0 0 0 0) } }
        @keyframes cs-stamp { 0% { transform: scale(3) rotate(-25deg); opacity: 0 } 60% { transform: scale(.9) rotate(-12deg); opacity: 1 } 100% { transform: scale(1) rotate(-12deg); opacity: .9 } }
        @keyframes cs-dissolve { 0% { opacity: 1; filter: none; transform: none } 100% { opacity: 0; filter: blur(4px) brightness(2); transform: translateY(-14px) scale(1.05) } }
        @keyframes cs-shake { 0%,100% { transform: none } 25% { transform: translate(-3px, 2px) } 50% { transform: translate(3px, -2px) } 75% { transform: translate(-2px, -1px) } }
        @keyframes cs-reveal { 0% { transform: rotateY(90deg) scale(.6); opacity: 0 } 60% { transform: rotateY(-10deg) scale(1.08); opacity: 1 } 100% { transform: none; opacity: 1 } }
        @keyframes cs-rays { from { transform: rotate(0) } to { transform: rotate(360deg) } }
      `}</style>

      {phase !== "reveal" ? (
        <div
          className="relative w-full max-w-md rounded-sm p-5 shadow-2xl sm:p-7"
          style={{
            background: `repeating-linear-gradient(0deg, transparent 0 27px, rgba(42,42,58,.08) 27px 28px), ${PAPER}`,
            color: INK,
            fontFamily: "'Courier New', ui-monospace, monospace",
            animation: phase === "stamp" ? "cs-shake .3s" : "cs-paper-in .45s ease-out",
          }}
        >
          <div className="text-center text-lg font-bold tracking-widest">КОНТРАКТ НА ОБМЕН</div>
          <div className="mb-4 text-center text-[11px] opacity-70">СильченкоДроп · форма №{items.length}-{Math.round(value)}</div>
          <p className="mb-3 text-xs leading-relaxed">
            Я, нижеподписавшийся, передаю следующие предметы в обмен на один случайный предмет:
          </p>

          <ol className="space-y-1 text-xs">
            {items.slice(0, lines).map((it, i) => (
              <li
                key={it.id}
                className="flex items-center gap-2"
                style={{
                  animation:
                    phase === "dissolve" || phase === "stamp"
                      ? phase === "dissolve"
                        ? `cs-dissolve .5s ease-in ${i * 0.11}s forwards`
                        : undefined
                      : "cs-line-in .25s linear",
                }}
              >
                <span className="w-5 shrink-0 text-right opacity-60">{i + 1}.</span>
                <span className="h-6 w-8 shrink-0 rounded-sm" style={{ boxShadow: `inset 0 -2px 0 ${rarityColor(it.rarity)}` }}>
                  <SkinImage src={it.image} name={it.name} className="h-full w-full" />
                </span>
                <span className="min-w-0 flex-1 truncate">{it.name}</span>
                <span className="shrink-0">{money(it.price)}</span>
              </li>
            ))}
          </ol>

          <div className="mt-3 flex justify-between border-t border-dashed border-[rgba(42,42,58,.4)] pt-2 text-xs font-bold">
            <span>ИТОГО</span>
            <span>{lines >= items.length ? money(value) : "…"}</span>
          </div>

          {/* подпись */}
          <div className={`mt-5 transition-opacity duration-300 ${phase === "writing" ? "opacity-30" : "opacity-100"}`}>
            <div className="mb-1 flex items-baseline justify-between text-[11px]">
              <span>Подпись:</span>
              {phase === "sign" && signed && (
                <button onClick={clear} className="underline opacity-70">
                  стереть
                </button>
              )}
            </div>
            <div className="relative h-28 rounded-sm border border-dashed" style={{ borderColor: "rgba(42,42,58,.35)", background: "rgba(255,255,255,.35)" }}>
              <canvas
                ref={canvas}
                className="absolute inset-0 h-full w-full"
                style={{ touchAction: "none", cursor: phase === "sign" ? "crosshair" : "default" }}
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={up}
                onPointerLeave={up}
              />
              {!signed && phase === "sign" && (
                <span className="pointer-events-none absolute inset-0 grid place-items-center text-xs opacity-50">распишись здесь пальцем или мышкой</span>
              )}
              <div className="pointer-events-none absolute inset-x-4 bottom-5 border-b" style={{ borderColor: "rgba(42,42,58,.4)" }} />
            </div>
          </div>

          {/* печать */}
          {(phase === "stamp" || phase === "dissolve") && (
            <div
              className="pointer-events-none absolute right-5 top-1/3 grid h-28 w-28 place-items-center rounded-full border-4 text-center text-sm font-bold"
              style={{ borderColor: "#b3261e", color: "#b3261e", animation: "cs-stamp .35s ease-out forwards" }}
            >
              ПОДПИСАНО
              <br />
              <span className="text-[10px]">СИЛЬЧЕНКО</span>
            </div>
          )}

          <div className="mt-5 flex gap-2" style={{ fontFamily: "var(--font-body)" }}>
            <button onClick={() => onClose(false)} disabled={busy} className="h-11 flex-1 rounded border border-[rgba(42,42,58,.4)] text-sm disabled:opacity-40">
              Отмена
            </button>
            <button
              onClick={confirm}
              disabled={phase !== "sign" || !signed}
              className="h-11 flex-[2] rounded text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: "#2f4a2a" }}
            >
              {phase === "sending" ? "Отправляем…" : busy ? "Обработка…" : signed ? "Подтвердить контракт" : "Сначала распишись"}
            </button>
          </div>
        </div>
      ) : (
        res && (
          <div className="relative grid w-full max-w-sm place-items-center text-center">
            {/* лучи за предметом */}
            <div
              className="pointer-events-none absolute h-80 w-80 rounded-full opacity-60"
              style={{
                background: `repeating-conic-gradient(${rarityColor(res.item.rarity)}55 0 10deg, transparent 10deg 20deg)`,
                maskImage: "radial-gradient(circle, #000 20%, transparent 70%)",
                WebkitMaskImage: "radial-gradient(circle, #000 20%, transparent 70%)",
                animation: "cs-rays 8s linear infinite",
              }}
            />
            <div
              className="panel relative w-full p-5"
              style={{ animation: "cs-reveal .7s ease-out", boxShadow: `0 0 40px 4px ${rarityColor(res.item.rarity)}66`, borderColor: rarityColor(res.item.rarity) }}
            >
              <div className="text-xs" style={{ color: rarityColor(res.item.rarity) }}>
                {rarityLabel(res.item.rarity)}
              </div>
              <SkinImage src={res.item.image} name={res.item.name} className="mx-auto my-3 h-32 w-48" />
              <div className="font-display text-xl leading-tight">{res.item.name}</div>
              <div className={`mt-1 text-sm ${good ? "text-ok" : "text-dust"}`}>
                {money(res.item.price)} · {Math.round((res.item.price / res.value) * 100)}% от вложенного
              </div>
              <button onClick={() => onClose(true)} className="btn-primary mt-4 h-11 w-full">
                Забрать
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

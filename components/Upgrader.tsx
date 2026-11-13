"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { rarityColor } from "@/lib/rarity";
import { money } from "@/lib/format";
import { upgradeChance } from "@/lib/upgrade";
import SkinImage from "./SkinImage";

type Inv = { id: string; name: string; rarity: string; image: string | null; price: number };
type Target = { marketHashName: string; name: string; rarity: string; image: string | null; wear: string | null; price: number };

const MULTS = [1.5, 2, 3, 5, 10];
const SPIN_MS = 4500;

export default function Upgrader({ inventory, edge, maxChance }: { inventory: Inv[]; edge: number; maxChance: number }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [stOnly, setStOnly] = useState("");
  const [targets, setTargets] = useState<Target[]>([]);
  const [target, setTarget] = useState<Target | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const [result, setResult] = useState<null | { success: boolean }>(null);
  const [error, setError] = useState<string | null>(null);

  const value = useMemo(
    () => Math.round(inventory.filter((i) => picked.includes(i.id)).reduce((s, i) => s + i.price, 0) * 100) / 100,
    [picked, inventory],
  );
  const chance = target ? upgradeChance(value, target.price, edge, maxChance) : 0;

  // подгружаем цели дороже ставки
  useEffect(() => {
    const t = setTimeout(async () => {
      const p = new URLSearchParams({ min: String(value), q, st: stOnly });
      const res = await fetch(`/api/catalog/targets?${p}`);
      if (res.ok) setTargets(await res.json());
    }, 250);
    return () => clearTimeout(t);
  }, [value, q, stOnly]);

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
    const list: Target[] = await res.json();
    if (list[0]) {
      setTarget(list[0]);
      setResult(null);
    }
  }

  async function go() {
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
    // стрелка встаёт ровно туда, куда выпал бросок сервера: зелёная зона — [0, шанс)
    const base = angle - (angle % 360) + 360 * 5;
    setAngle(base + data.roll * 360);
    setTimeout(() => {
      setSpinning(false);
      setResult({ success: data.success });
      setPicked([]);
      router.refresh();
    }, SPIN_MS + 100);
  }

  const R = 90;
  const C = 2 * Math.PI * R;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px_1fr]">
      {/* ставка */}
      <section className="panel flex min-h-[420px] flex-col p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="font-medium">Твои скины</span>
          <span className="text-sm text-dust">Ставка: {money(value)}</span>
        </div>
        {inventory.length === 0 ? (
          <p className="text-sm text-dust">Инвентарь пуст. Открой кейс, и сюда будет что поставить.</p>
        ) : (
          <div className="grid max-h-[460px] grid-cols-3 gap-2 overflow-y-auto pr-1">
            {inventory.map((i) => {
              const on = picked.includes(i.id);
              return (
                <button
                  key={i.id}
                  onClick={() => toggle(i.id)}
                  className={`rounded border bg-raised/40 p-2 text-left text-xs ${on ? "border-stencil" : "border-line hover:border-dust"}`}
                  style={{ boxShadow: `inset 0 -2px 0 ${rarityColor(i.rarity)}` }}
                >
                  <SkinImage src={i.image} name={i.name} className="h-12 w-full" />
                  <div className="mt-1 truncate text-dust">{i.name}</div>
                  <div>{money(i.price)}</div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* круг */}
      <section className="flex flex-col items-center justify-center gap-4">
        <div className="relative h-[220px] w-[220px]">
          <svg viewBox="0 0 220 220" className="h-full w-full -rotate-90">
            <circle cx="110" cy="110" r={R} fill="none" stroke="#353b33" strokeWidth="14" />
            <circle
              cx="110"
              cy="110"
              r={R}
              fill="none"
              stroke={result ? (result.success ? "#8fbf6a" : "#e0614a") : "#e0b43a"}
              strokeWidth="14"
              strokeDasharray={`${(chance / 100) * C} ${C}`}
              style={{ transition: "stroke-dasharray 300ms" }}
            />
          </svg>
          {/* стрелка */}
          <div
            className="absolute inset-0"
            style={{
              transform: `rotate(${angle}deg)`,
              transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.15, 0.7, 0.1, 1)` : "none",
            }}
          >
            <div className="absolute left-1/2 top-[6px] h-[30px] w-[3px] -translate-x-1/2 bg-bone" />
          </div>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="font-display text-3xl">{chance ? `${chance}%` : "—"}</div>
              <div className="text-xs text-dust">
                {result ? (result.success ? "Апгрейд удался" : "Не повезло") : "шанс"}
              </div>
            </div>
          </div>
        </div>
        <button onClick={go} disabled={!target || !picked.length || spinning || chance < 0.5} className="btn-primary h-11 w-full text-base">
          {spinning ? "Крутится…" : "Апгрейд"}
        </button>
        <div className="flex flex-wrap justify-center gap-1">
          {MULTS.map((m) => (
            <button key={m} onClick={() => pickMult(m)} disabled={!value || spinning} className="btn-ghost h-8 px-3 text-xs">
              ×{m}
            </button>
          ))}
        </div>
        {error && <p className="text-center text-sm text-danger">{error}</p>}
        {result?.success && <p className="text-center text-sm text-ok">Скин уже в инвентаре.</p>}
      </section>

      {/* цель */}
      <section className="panel flex min-h-[420px] flex-col p-4">
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
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск" className="input h-9" />
          <select value={stOnly} onChange={(e) => setStOnly(e.target.value)} className="input h-9 w-28">
            <option value="">Все</option>
            <option value="0">Без ST</option>
            <option value="1">StatTrak</option>
          </select>
        </div>
        <div className="max-h-[400px] space-y-1 overflow-y-auto pr-1">
          {targets.map((t) => (
            <button
              key={t.marketHashName}
              onClick={() => !spinning && (setTarget(t), setResult(null))}
              className={`flex w-full items-center gap-2 rounded border px-2 py-1 text-left text-xs ${
                target?.marketHashName === t.marketHashName ? "border-stencil" : "border-transparent hover:border-line"
              }`}
            >
              <span className="h-6 w-1 shrink-0" style={{ background: rarityColor(t.rarity) }} />
              <SkinImage src={t.image} name={t.name} className="h-8 w-10 shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                {t.name}
                {t.wear && <span className="text-dust"> ({t.wear})</span>}
              </span>
              <span>{money(t.price)}</span>
            </button>
          ))}
          {targets.length === 0 && <p className="text-sm text-dust">Ничего не нашлось.</p>}
        </div>
      </section>
    </div>
  );
}

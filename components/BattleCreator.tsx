"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";
import SkinImage from "./SkinImage";

type Case = { id: string; name: string; image: string | null; price: number };

const MAX_CASES = 10;

export default function BattleCreator({ cases, loggedIn, balance }: { cases: Case[]; loggedIn: boolean; balance: number }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]); // по порядку раундов, повторы можно
  const [players, setPlayers] = useState(2);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byId = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases]);
  const cost = Math.round(picked.reduce((s, id) => s + (byId.get(id)?.price ?? 0), 0) * 100) / 100;
  const shown = q ? cases.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())) : cases;
  const countOf = (id: string) => picked.filter((x) => x === id).length;

  const add = (id: string) => setPicked((p) => (p.length >= MAX_CASES ? p : [...p, id]));
  const removeOne = (id: string) =>
    setPicked((p) => {
      const i = p.lastIndexOf(id);
      return i < 0 ? p : [...p.slice(0, i), ...p.slice(i + 1)];
    });

  async function create() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/battles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseIds: picked, players }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setError(data.error ?? "Не получилось создать комнату");
    }
    router.push(`/battles/${data.id}`);
  }

  return (
    <div className="panel space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium">Новая комната</span>
        <div className="flex gap-1" role="group" aria-label="Сколько игроков">
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => setPlayers(n)}
              aria-pressed={players === n}
              className={`h-10 rounded border px-3 text-sm font-semibold ${
                players === n ? "border-stencil bg-stencil text-ground" : "border-line text-dust hover:text-bone"
              }`}
            >
              {Array(n).fill("1").join(" vs ")}
            </button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти кейс" className="input h-10 sm:ml-auto sm:w-56" />
      </div>

      {/* выбранные кейсы по раундам */}
      <div className="flex min-h-[64px] flex-wrap gap-1.5 rounded border border-dashed border-line p-2">
        {picked.length === 0 && <span className="self-center px-1 text-sm text-dust">Нажимай на кейсы ниже, до {MAX_CASES} штук. Можно одинаковые.</span>}
        {picked.map((id, i) => {
          const c = byId.get(id);
          return (
            <button
              key={i}
              onClick={() => setPicked((p) => [...p.slice(0, i), ...p.slice(i + 1)])}
              className="relative h-12 w-14 rounded border border-line bg-raised p-1"
              title={`${c?.name} — убрать`}
            >
              <SkinImage src={c?.image} name={c?.name ?? ""} className="h-full w-full" />
              <span className="absolute -left-1 -top-1 rounded bg-ground px-1 text-[10px] text-dust">{i + 1}</span>
            </button>
          );
        })}
      </div>

      <div className="grid max-h-[360px] grid-cols-2 gap-2 overflow-y-auto pr-1 min-[480px]:grid-cols-3 md:grid-cols-5">
        {shown.map((c) => {
          const n = countOf(c.id);
          return (
            <div key={c.id} className={`flex flex-col rounded border bg-raised/40 ${n ? "border-stencil" : "border-line"}`}>
              <button onClick={() => add(c.id)} className="flex flex-col items-center gap-1 p-2 text-center" disabled={picked.length >= MAX_CASES}>
                <SkinImage src={c.image} name={c.name} className="h-14 w-full" />
                <span className="w-full truncate text-xs">{c.name}</span>
                <span className="text-xs text-stencil">{money(c.price)}</span>
              </button>
              {n > 0 && (
                <div className="flex items-center justify-between border-t border-line text-sm">
                  <button onClick={() => removeOne(c.id)} className="h-8 w-10 text-dust hover:text-bone" aria-label="Убрать один">
                    −
                  </button>
                  <span>×{n}</span>
                  <button onClick={() => add(c.id)} disabled={picked.length >= MAX_CASES} className="h-8 w-10 text-dust hover:text-bone disabled:opacity-40" aria-label="Добавить ещё">
                    +
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {loggedIn ? (
          <button onClick={create} disabled={busy || picked.length === 0 || balance < cost} className="btn-primary h-12 w-full text-base sm:w-auto sm:px-6">
            {busy ? "Создаю…" : picked.length ? `Создать за ${money(cost)}` : "Выбери кейсы"}
          </button>
        ) : (
          <a href="/api/auth/steam/login" className="btn-primary h-12 w-full text-base sm:w-auto">
            Войти через Steam
          </a>
        )}
        <span className="text-sm text-dust">
          {picked.length}/{MAX_CASES} кейсов. Каждый участник платит {money(cost)}, победитель забирает всё на сумму около {money(cost * players)}.
        </span>
        {loggedIn && balance < cost && <p className="w-full text-sm text-danger">Не хватает {money(cost - balance)}.</p>}
        {error && <p className="w-full text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}

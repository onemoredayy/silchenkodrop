"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BattleView } from "@/lib/battle";
import { money } from "@/lib/format";
import { rarityColor } from "@/lib/rarity";
import Avatar from "./Avatar";
import SkinImage from "./SkinImage";

const POLL_MS = 2000;
const ROUND_MS = 2200; // сколько длится один раунд при показе
const SPIN_MS = 1400; // из них — «крутится»

export default function BattleRoom({ initial, me }: { initial: BattleView; me: { id: string; balance: number; isAdmin: boolean } | null }) {
  const router = useRouter();
  const [b, setB] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // сколько раундов уже показано; если батл закончился давно — показываем всё сразу
  const finishedLongAgo = initial.status === "DONE" && initial.finishedAt && Date.now() - Date.parse(initial.finishedAt) > 60_000;
  const [shown, setShown] = useState(finishedLongAgo ? initial.rounds.length : 0);
  const [spinning, setSpinning] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ждём игроков: опрашиваем сервер
  useEffect(() => {
    if (b.status !== "OPEN") return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/battles/${b.id}`, { cache: "no-store" }).catch(() => null);
      if (res?.ok) setB(await res.json());
    }, POLL_MS);
    return () => clearInterval(t);
  }, [b.id, b.status]);

  // батл сыгран: показываем раунды по очереди
  useEffect(() => {
    if (b.status !== "DONE" || shown >= b.rounds.length) return;
    setSpinning(true);
    const t1 = setTimeout(() => setSpinning(false), SPIN_MS);
    const t2 = setTimeout(() => setShown((s) => s + 1), ROUND_MS);
    timers.current.push(t1, t2);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [b.status, shown, b.rounds.length]);

  useEffect(() => {
    if (b.status === "DONE" && shown >= b.rounds.length) router.refresh(); // обновить баланс в шапке
  }, [b.status, shown, b.rounds.length, router]);

  const skip = () => {
    timers.current.forEach(clearTimeout);
    setSpinning(false);
    setShown(b.rounds.length);
  };

  async function act(path: "join" | "cancel") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/battles/${b.id}/${path}`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error ?? "Ошибка");
    const fresh = await fetch(`/api/battles/${b.id}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));
    if (fresh) setB(fresh);
    setBusy(false);
    router.refresh();
  }

  const done = b.status === "DONE";
  const finished = done && shown >= b.rounds.length;
  // текущий раунд, который сейчас «крутится» или только что открылся
  const current = done ? Math.min(shown, b.rounds.length - 1) : -1;
  const visibleRounds = done ? (spinning ? shown : shown + 1) : 0; // сколько раундов уже видно с результатом
  const inRoom = !!me && b.players.some((p) => p.userId === me.id);
  const canJoin = !!me && b.status === "OPEN" && !inRoom && b.players.length < b.maxPlayers;
  const canCancel = !!me && b.status === "OPEN" && (b.creatorId === me.id || me.isAdmin);
  const totalPot = b.drops.reduce((s, d) => s + d.price, 0);

  const playerTotal = (uid: string) =>
    b.drops.filter((d) => d.userId === uid && d.round < Math.min(visibleRounds, b.rounds.length)).reduce((s, d) => s + d.price, 0);
  const slots = Array.from({ length: b.maxPlayers }, (_, i) => b.players.find((p) => p.slot === i) ?? null);
  const leader = finished ? b.winnerId : null;

  return (
    <div className="space-y-4">
      {/* раунды — кейсы по порядку */}
      <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        {b.rounds.map((c, i) => (
          <div
            key={i}
            className={`flex w-20 shrink-0 flex-col items-center rounded border p-1.5 text-center ${
              i === current && !finished ? "border-stencil" : i < visibleRounds ? "border-line opacity-60" : "border-line"
            }`}
          >
            <SkinImage src={c.image} name={c.name} className="h-10 w-full" />
            <span className="mt-1 w-full truncate text-[10px] text-dust">{c.name}</span>
          </div>
        ))}
      </div>

      {/* статус и кнопки */}
      <div className="panel flex flex-wrap items-center gap-3 p-3 sm:p-4">
        {b.status === "OPEN" && (
          <span className="text-sm">
            Ждём игроков: <span className="text-stencil">{b.players.length}/{b.maxPlayers}</span>. Вход {money(b.cost)}.
          </span>
        )}
        {done && !finished && (
          <>
            <span className="text-sm">
              Раунд {Math.min(shown + 1, b.rounds.length)} из {b.rounds.length}
            </span>
            <button onClick={skip} className="btn-ghost h-9 sm:ml-auto">
              Показать сразу
            </button>
          </>
        )}
        {finished && (
          <span className="text-sm">
            <a href={`/u/${b.winnerId}`} className="text-stencil hover:underline">{b.players.find((p) => p.userId === b.winnerId)?.username}</a> забирает всё:{" "}
            {b.drops.length} скинов на {money(totalPot)}
            {me && b.winnerId === me.id && <span className="text-ok"> — это ты! Скины уже в инвентаре.</span>}
          </span>
        )}
        {b.status === "CANCELLED" && <span className="text-sm text-dust">Комната отменена, деньги вернулись участникам.</span>}
        {canJoin && (
          <button onClick={() => act("join")} disabled={busy || me!.balance < b.cost} className="btn-primary h-11 w-full sm:ml-auto sm:w-auto">
            {me!.balance < b.cost ? `Не хватает ${money(b.cost - me!.balance)}` : `Войти за ${money(b.cost)}`}
          </button>
        )}
        {!me && b.status === "OPEN" && (
          <a href="/api/auth/steam/login" className="btn-primary h-11 w-full sm:ml-auto sm:w-auto">
            Войти через Steam, чтобы играть
          </a>
        )}
        {canCancel && (
          <button onClick={() => act("cancel")} disabled={busy} className={`btn-ghost h-11 w-full sm:w-auto ${canJoin ? "" : "sm:ml-auto"}`}>
            Отменить комнату
          </button>
        )}
        {b.status === "OPEN" && inRoom && (
          <span className="w-full text-xs text-dust">Скинь ссылку на эту страницу друзьям — батл начнётся, как только все зайдут.</span>
        )}
        {error && <p className="w-full text-sm text-danger">{error}</p>}
      </div>

      {/* игроки */}
      <div className={`grid gap-2 sm:gap-3 ${b.maxPlayers === 2 ? "grid-cols-2" : b.maxPlayers === 3 ? "grid-cols-3" : "grid-cols-2 md:grid-cols-4"}`}>
        {slots.map((p, i) => {
          if (!p) {
            return (
              <div key={i} className="panel grid min-h-[200px] place-items-center p-3 text-center text-sm text-dust">
                <div>
                  <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded border border-dashed border-line text-xl">?</div>
                  Свободное место
                </div>
              </div>
            );
          }
          const drops = b.drops.filter((d) => d.userId === p.userId);
          const cur = drops.find((d) => d.round === current);
          const past = drops.filter((d) => d.round < visibleRounds && d.round !== current).reverse();
          const isWinner = leader === p.userId;
          const lost = finished && !isWinner;
          return (
            <div key={i} className={`panel flex min-w-0 flex-col overflow-hidden ${isWinner ? "border-stencil" : ""} ${lost ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-2 border-b border-line p-2 sm:p-3">
                <a href={`/u/${p.userId}`} className="flex min-w-0 flex-1 items-center gap-2 hover:text-stencil" title="Профиль">
                  <Avatar src={p.avatar} name={p.username} size={28} />
                  <span className="min-w-0 flex-1 truncate text-sm">{p.username}</span>
                </a>
              </div>
              <div className="border-b border-line px-2 py-1.5 text-center font-display text-lg sm:text-xl">
                {money(playerTotal(p.userId))}
              </div>

              {/* текущий раунд */}
              {done && !finished && (
                <div
                  className="flex h-32 flex-col items-center justify-center gap-1 p-2"
                  style={!spinning && cur ? { boxShadow: `inset 0 -3px 0 ${rarityColor(cur.item.rarity)}` } : undefined}
                >
                  {spinning || !cur ? (
                    <SkinImage
                      src={b.rounds[current]?.image}
                      name="крутится"
                      className="h-16 w-20 animate-bounce opacity-70"
                    />
                  ) : (
                    <>
                      <SkinImage src={cur.item.image} name={cur.item.name} className="h-16 w-20" />
                      <span className="w-full truncate text-center text-xs">{cur.item.name}</span>
                      <span className="text-xs text-dust">{money(cur.price)}</span>
                    </>
                  )}
                </div>
              )}
              {isWinner && <div className="bg-stencil py-1 text-center text-xs font-semibold text-ground">ПОБЕДИТЕЛЬ</div>}

              {/* что выпало раньше */}
              <div className="flex-1 divide-y divide-line/60">
                {(finished ? drops : past).map((d) => (
                  <div key={d.round} className="flex items-center gap-2 px-2 py-1.5" style={{ boxShadow: `inset 3px 0 0 ${rarityColor(d.item.rarity)}` }}>
                    <SkinImage src={d.item.image} name={d.item.name} className="h-7 w-9 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-[11px] sm:text-xs">{d.item.name}</span>
                    <span className="hidden text-xs text-dust min-[480px]:inline">{money(d.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

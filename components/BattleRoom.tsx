"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BattleView } from "@/lib/battle";
import { money } from "@/lib/format";
import { rarityColor } from "@/lib/rarity";
import Avatar from "./Avatar";
import SkinImage from "./SkinImage";
import Fireworks from "./Fireworks";
import { tickWhileMoving, unlockAudio, win } from "@/lib/sfx";

const POLL_MS = 2000;
const ROUND_MS = 4300; // сколько длится один раунд при показе
const SPIN_MS = 3200; // из них — крутится лента
const REEL_LEN = 32;
const REEL_WIN = 27;
const ROW = 72; // высота карточки в вертикальной ленте

type Mini = { name: string; rarity: string; image: string | null };
const readY = (m: DOMMatrix) => -m.m42;

// Вертикальная лента игрока в раунде: крутится при появлении и встаёт на его дроп
function BattleReel({ pool, drop, top, ticking }: { pool: (Mini & { chance: number })[]; drop: Mini; top: boolean; ticking: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [y, setY] = useState(0);
  const [landed, setLanded] = useState(false);
  const [strip] = useState<Mini[]>(() => {
    const total = pool.reduce((a, p) => a + p.chance, 0) || 1;
    const pick = () => {
      let r = Math.random() * total;
      for (const p of pool) if ((r -= p.chance) <= 0) return p;
      return pool[0] ?? drop;
    };
    return Array.from({ length: REEL_LEN }, (_, i) => (i === REEL_WIN ? drop : pick()));
  });

  useEffect(() => {
    const h = box.current?.clientHeight ?? 128;
    let stop = () => {};
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        const jitter = (Math.random() - 0.5) * ROW * 0.6;
        setY(-(REEL_WIN * ROW + ROW / 2 - h / 2 + jitter));
        if (ticking && ref.current) stop = tickWhileMoving(ref.current, readY, ROW, SPIN_MS + 50);
      });
    });
    const t = setTimeout(() => setLanded(true), SPIN_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={box}
      className={`relative h-36 overflow-hidden ${landed && top ? "reel-flash" : ""}`}
      style={{
        maskImage: "linear-gradient(180deg, transparent, #000 22%, #000 78%, transparent)",
        WebkitMaskImage: "linear-gradient(180deg, transparent, #000 22%, #000 78%, transparent)",
      }}
    >
      <div
        ref={ref}
        style={{ transform: `translateY(${y}px)`, transition: y ? `transform ${SPIN_MS}ms cubic-bezier(0.1, 0.65, 0.12, 1)` : "none" }}
      >
        {strip.map((it, i) => {
          const win_ = landed && i === REEL_WIN;
          return (
            <div key={i} className="flex items-center justify-center px-2" style={{ height: ROW }}>
              <div
                className={`relative flex h-[62px] w-full max-w-[120px] items-center justify-center rounded border border-line bg-panel transition-opacity duration-300 ${
                  win_ ? (top ? "reel-jackpot" : "reel-win") : landed ? "opacity-30" : ""
                }`}
                style={{
                  boxShadow: win_ && !top ? `0 0 16px 2px ${rarityColor(it.rarity)}` : `inset 0 -3px 0 ${rarityColor(it.rarity)}`,
                }}
              >
                <SkinImage src={it.image} name={it.name} className="h-12 w-16" />
              </div>
            </div>
          );
        })}
      </div>
      {/* указатели слева и справа */}
      <div className="pointer-events-none absolute left-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[7px] border-l-[9px] border-y-transparent border-l-stencil" />
      <div className="pointer-events-none absolute right-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[7px] border-r-[9px] border-y-transparent border-r-stencil" />
    </div>
  );
}

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
  const [fire, setFire] = useState(0);
  const animated = useRef(!finishedLongAgo); // салют только если батл досмотрели сейчас

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
    if (b.status === "DONE" && shown >= b.rounds.length) {
      router.refresh(); // обновить баланс в шапке
      if (animated.current) {
        animated.current = false;
        setFire((f) => f + 1);
        win();
      }
    }
  }, [b.status, shown, b.rounds.length, router]);

  // браузер разрешит щелчки ленты только после любого нажатия на странице
  useEffect(() => {
    const on = () => unlockAudio();
    window.addEventListener("pointerdown", on, { once: true });
    return () => window.removeEventListener("pointerdown", on);
  }, []);

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
      <Fireworks fire={fire} ms={3500} />
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
              {done && !finished && cur && (
                <div className="border-b border-line">
                  <BattleReel
                    key={current}
                    pool={b.rounds[current]?.pool ?? []}
                    drop={cur.item}
                    top={cur.price >= (b.rounds[current]?.price ?? 0) * 10}
                    ticking={i === 0}
                  />
                  <div className="h-10 px-2 py-1 text-center">
                    {!spinning && (
                      <>
                        <div className="truncate text-xs">{cur.item.name}</div>
                        <div className="text-xs text-dust">{money(cur.price)}</div>
                      </>
                    )}
                  </div>
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

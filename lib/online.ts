// Кто сейчас на сайте: браузер раз в ~45 с шлёт «я тут» (/api/online).
// Хранится в памяти процесса — после перезапуска сайта счётчик набирается заново за минуту.
type Seen = { at: number; userId: string | null };
const g = globalThis as unknown as { __online?: Map<string, Seen> };
const seen = (g.__online ??= new Map());

export const ONLINE_WINDOW_MS = 2 * 60_000;

export function touchOnline(visitorId: string, userId: string | null) {
  seen.set(visitorId, { at: Date.now(), userId });
  if (seen.size > 5000) cleanup();
}

function cleanup() {
  const cut = Date.now() - ONLINE_WINDOW_MS;
  for (const [k, v] of seen) if (v.at < cut) seen.delete(k);
}

// Точные цифры — для админки
export function onlineStats() {
  cleanup();
  const users = new Set<string>();
  let guests = 0;
  for (const v of seen.values()) {
    if (v.userId) users.add(v.userId);
    else guests++;
  }
  return { total: users.size + guests, userIds: [...users], guests };
}

// «Витринный» онлайн для сайта: 50–230, больше вечером по Москве, плавно гуляет.
// Одинаковый для всех посетителей в одну и ту же минуту.
export function shownOnline(now = Date.now()) {
  const msk = new Date(now + 3 * 3600_000);
  const h = msk.getUTCHours() + msk.getUTCMinutes() / 60;
  const t = now / 60_000; // минуты
  const daily = 140 + 75 * Math.cos((2 * Math.PI * (h - 21)) / 24); // пик в 21:00, спад к 9 утра
  const wobble = 9 * Math.sin(t / 7) + 5 * Math.sin(t / 2.3 + 1) + 3 * Math.sin(t / 0.9 + 2);
  return Math.round(Math.min(230, Math.max(50, daily + wobble)));
}

const rub = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function money(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${rub.format(Math.round(n * 100) / 100)} ₽`;
}

export function dateTime(d: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function ago(d: Date) {
  const s = Math.max(1, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 60) return `${s} с`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} мин`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ч`;
  return `${Math.round(h / 24)} д`;
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// RTP кейса — сколько процентов от цены кейса в среднем возвращается дропом.
import { round2 } from "./format";

export function caseRtp(ev: number, price: number) {
  return price > 0 ? round2((ev / price) * 100) : 0;
}

// Шансы (в %, сумма 100) для заданных цен, чтобы средний дроп был равен target.
// Форма шансов: чем дороже предмет, тем реже (вес = цена^-a), подбираем a.
// Возвращает null, если target нельзя получить из этих цен.
export function solveChances(prices: number[], target: number): number[] | null {
  const ps = prices.map((p) => Math.max(p, 0.01));
  if (ps.length === 0) return null;
  const min = Math.min(...ps);
  const max = Math.max(...ps);
  if (ps.length === 1) return Math.abs(ps[0] - target) < 0.01 ? [100] : null;
  if (target <= min || target >= max) return null;

  const ev = (a: number) => {
    // нормируем на минимальную цену, чтобы не уйти в бесконечность
    const w = ps.map((p) => Math.pow(p / min, -a));
    const s = w.reduce((x, y) => x + y, 0);
    return { ev: ps.reduce((acc, p, i) => acc + (p * w[i]) / s, 0), w, s };
  };
  let lo = -20; // отрицательное a — дорогие чаще
  let hi = 40;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (ev(mid).ev > target) lo = mid;
    else hi = mid;
  }
  const { w, s } = ev((lo + hi) / 2);
  const out = w.map((x) => Math.max(0.0001, Math.floor((x / s) * 100 * 10000) / 10000));
  // погрешность округления — самому частому предмету
  const top = out.indexOf(Math.max(...out));
  out[top] = Math.round((out[top] + 100 - out.reduce((a, b) => a + b, 0)) * 10000) / 10000;
  return out;
}

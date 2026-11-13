import { round2 } from "./format";

// Шанс апгрейда в %: доля ставки от цели минус преимущество сайта, не больше максимума
export function upgradeChance(value: number, target: number, edgePct: number, maxPct: number) {
  if (value <= 0 || target <= 0) return 0;
  return round2(Math.min(maxPct, (value / target) * (100 - edgePct)));
}

export function catalogDisplayName(c: { baseName: string; statTrak: boolean }) {
  return c.statTrak ? c.baseName.replace(/^(★ )?/, "$1StatTrak™ ") : c.baseName;
}

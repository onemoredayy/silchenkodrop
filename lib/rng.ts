import { randomInt } from "crypto";

// Честный выбор на сервере: crypto.randomInt по весам dropChance
export function pickWeighted<T extends { dropChance: number }>(rows: T[]): T {
  const SCALE = 10_000; // точность до 0.0001%
  const weights = rows.map((r) => Math.max(0, Math.round(r.dropChance * SCALE)));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) throw new Error("В кейсе нет предметов с шансом > 0");
  let roll = randomInt(0, total);
  for (let i = 0; i < rows.length; i++) {
    if (roll < weights[i]) return rows[i];
    roll -= weights[i];
  }
  return rows[rows.length - 1];
}

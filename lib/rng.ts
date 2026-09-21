import { randomInt } from "crypto";

// Шансы хранятся с точностью до 3 знаков (например 0.125%),
// поэтому переводим их в целые "доли" и бросаем целочисленный кубик.
const SCALE = 1000;
const TOLERANCE = 0.01; // допустимое отклонение суммы шансов от 100

export type WithChance = { dropChance: number };

// Проверка шансов: каждый > 0, сумма = 100%
export function validateChances(entries: WithChance[]): void {
  if (entries.length === 0) {
    throw new Error("В кейсе нет предметов");
  }
  let sum = 0;
  for (const e of entries) {
    if (!Number.isFinite(e.dropChance) || e.dropChance <= 0) {
      throw new Error("Некорректный шанс выпадения");
    }
    sum += e.dropChance;
  }
  if (Math.abs(sum - 100) > TOLERANCE) {
    throw new Error(`Сумма шансов равна ${sum.toFixed(3)}%, а должна быть 100%`);
  }
}

// Выбор одного элемента с учётом шансов. ТОЛЬКО на сервере.
export function pickWeighted<T extends WithChance>(entries: T[]): T {
  validateChances(entries);

  const weights = entries.map((e) => Math.round(e.dropChance * SCALE));
  const total = weights.reduce((a, b) => a + b, 0);

  // Равномерное число от 0 до total - 1 (без смещения)
  let roll = randomInt(0, total);

  for (let i = 0; i < entries.length; i++) {
    if (roll < weights[i]) return entries[i];
    roll -= weights[i];
  }
  return entries[entries.length - 1];
}

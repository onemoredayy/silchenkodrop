type Bucket = { count: number; resetAt: number };

// Хранилище живёт в globalThis, чтобы не сбрасываться при перезагрузке модулей в dev
const g = globalThis as unknown as { __rateBuckets?: Map<string, Bucket> };
const buckets: Map<string, Bucket> = g.__rateBuckets ?? new Map();
g.__rateBuckets = buckets;

export type RateResult = { ok: boolean; retryAfterMs: number };

// Разрешает не больше `limit` запросов за окно `windowMs` на один ключ
export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();

  // Изредка чистим просроченные записи
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  }

  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfterMs: b.resetAt - now };
  }
  b.count += 1;
  return { ok: true, retryAfterMs: 0 };
}

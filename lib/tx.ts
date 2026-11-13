export const TX_LABEL: Record<string, string> = {
  DEPOSIT: "Пополнение",
  OPEN: "Открытие кейса",
  SELL: "Продажа",
  ADMIN: "Начисление админом",
};

export function txDetails(type: string, meta: string | null) {
  if (!meta) return "";
  try {
    const m = JSON.parse(meta) as Record<string, unknown>;
    if (type === "OPEN") return `${m.case}: ${m.item}`;
    if (type === "SELL") return `${m.count} шт.`;
    if (type === "ADMIN") return String(m.note ?? "");
    if (type === "DEPOSIT") return m.mock ? "тестовое" : "";
  } catch {}
  return "";
}

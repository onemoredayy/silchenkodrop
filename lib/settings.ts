import { prisma } from "./prisma";

export const DEFAULT_SETTINGS = {
  margin: "15", // % — только для подсказки «рекомендуемая цена кейса»
  sellCommission: "10", // % — сколько сайт удерживает при продаже скина
  depositBonus: "0", // % — бонус к тестовому пополнению
  trollChance: "5", // % — шанс «пук-прокрутки» (лента встаёт на топ и докручивает на выигрыш)
  upgradeEdge: "10", // % — преимущество сайта в апгрейдах
  upgradeMaxChance: "75", // % — максимальный шанс апгрейда
  usdRub: "0", // курс доллара для цен; 0 — брать курс ЦБ автоматически
};

export type SettingKey = keyof typeof DEFAULT_SETTINGS;

export async function getSettings() {
  const rows = await prisma.siteSetting.findMany();
  const map: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const r of rows) map[r.key] = r.value;
  return {
    margin: Number(map.margin) || 0,
    sellCommission: Number(map.sellCommission) || 0,
    depositBonus: Number(map.depositBonus) || 0,
    trollChance: Number(map.trollChance) || 0,
    upgradeEdge: Number(map.upgradeEdge) || 0,
    upgradeMaxChance: Number(map.upgradeMaxChance) || 75,
    usdRub: Number(map.usdRub) || 0,
  };
}

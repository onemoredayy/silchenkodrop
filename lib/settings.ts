import { prisma } from "./prisma";

export const DEFAULT_SETTINGS = {
  margin: "15", // % — только для подсказки «рекомендуемая цена кейса»
  sellCommission: "10", // % — сколько сайт удерживает при продаже скина
  depositBonus: "0", // % — бонус к тестовому пополнению
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
  };
}

// Цвета — как в самой CS2, без «неоновых» подмен
export const RARITIES = [
  "COMMON",
  "UNCOMMON",
  "RARE",
  "MYTHICAL",
  "LEGENDARY",
  "ANCIENT",
  "GOLD",
] as const;

export type Rarity = (typeof RARITIES)[number];

export const RARITY: Record<string, { label: string; color: string }> = {
  COMMON: { label: "Ширпотреб", color: "#b0c3d9" },
  UNCOMMON: { label: "Промышленное", color: "#5e98d9" },
  RARE: { label: "Армейское", color: "#4b69ff" },
  MYTHICAL: { label: "Запрещённое", color: "#8847ff" },
  LEGENDARY: { label: "Засекреченное", color: "#d32ce6" },
  ANCIENT: { label: "Тайное", color: "#eb4b4b" },
  GOLD: { label: "★ Редкий предмет", color: "#e4ae39" },
};

export function rarityColor(r: string) {
  return RARITY[r]?.color ?? "#8a8f98";
}

export function rarityLabel(r: string) {
  return RARITY[r]?.label ?? r;
}

// ByMykel rarity.id → наша редкость
export function mapCatalogRarity(id: string | undefined, name = ""): Rarity {
  if (name.startsWith("★") || id === "rarity_contraband") return "GOLD";
  switch (id) {
    case "rarity_common_weapon":
    case "rarity_common":
      return "COMMON";
    case "rarity_uncommon_weapon":
    case "rarity_uncommon":
      return "UNCOMMON";
    case "rarity_rare_weapon":
    case "rarity_rare":
      return "RARE";
    case "rarity_mythical_weapon":
    case "rarity_mythical":
      return "MYTHICAL";
    case "rarity_legendary_weapon":
    case "rarity_legendary":
      return "LEGENDARY";
    default:
      return "ANCIENT";
  }
}

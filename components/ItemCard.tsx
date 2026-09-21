export type ItemData = {
  name: string;
  rarity: string;
  price: number;
  image: string;
  wear: string | null;
  statTrak: boolean;
};

// Цвета редкости (классы записаны целиком, чтобы Tailwind их увидел)
export const RARITY: Record
  string,
  { label: string; text: string; border: string; bg: string; bar: string }
> = {
  COMMON: {
    label: "Обычный",
    text: "text-zinc-300",
    border: "border-zinc-500/60",
    bg: "from-zinc-500/25",
    bar: "bg-zinc-400",
  },
  UNCOMMON: {
    label: "Необычный",
    text: "text-blue-400",
    border: "border-blue-500/60",
    bg: "from-blue-500/25",
    bar: "bg-blue-500",
  },
  RARE: {
    label: "Редкий",
    text: "text-sky-300",
    border: "border-sky-400/60",
    bg: "from-sky-400/25",
    bar: "bg-sky-400",
  },
  MYTHICAL: {
    label: "Мифический",
    text: "text-purple-400",
    border: "border-purple-500/60",
    bg: "from-purple-500/25",
    bar: "bg-purple-500",
  },
  LEGENDARY: {
    label: "Легендарный",
    text: "text-pink-400",
    border: "border-pink-500/60",
    bg: "from-pink-500/25",
    bar: "bg-pink-500",
  },
  ANCIENT: {
    label: "Древний",
    text: "text-red-400",
    border: "border-red-500/60",
    bg: "from-red-500/25",
    bar: "bg-red-500",
  },
};

export function rarityOf(rarity: string) {
  return RARITY[rarity] ?? RARITY.COMMON;
}

const WEAR_SHORT: Record<string, string> = {
  "Factory New": "FN",
  "Minimal Wear": "MW",
  "Field-Tested": "FT",
  "Well-Worn": "WW",
  "Battle-Scarred": "BS",
};

export default function ItemCard({
  item,
  compact = false,
}: {
  item: ItemData;
  compact?: boolean;
}) {
  const r = rarityOf(item.rarity);
  const [weapon, skin] = item.name.includes(" | ")
    ? item.name.split(" | ")
    : [item.name, ""];
  const wear = item.wear ? WEAR_SHORT[item.wear] ?? item.wear : "";

  return (
    <div
      className={`relative flex h-full w-full flex-col overflow-hidden rounded-lg border bg-gradient-to-b to-card ${r.border} ${r.bg}`}
    >
      <div className="relative flex flex-1 items-center justify-center p-2">
        <span className="text-xl font-black tracking-widest text-white/10">CS2</span>
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image}
            alt={item.name}
            className="absolute inset-0 h-full w-full object-contain p-2"
          />
        ) : null}
        {item.statTrak ? (
          <span className="absolute left-1.5 top-1.5 text-[10px] font-bold text-orange-400">
            ST™
          </span>
        ) : null}
      </div>

      <div className="px-2 pb-2">
        <p className="truncate text-[11px] text-muted-foreground">{weapon}</p>
        <p className={`truncate text-sm font-semibold ${r.text}`}>{skin || weapon}</p>
        {!compact ? (
          <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{wear}</span>
            <span className="font-semibold text-foreground">
              {item.price.toLocaleString("ru-RU")} ₽
            </span>
          </div>
        ) : null}
      </div>

      <div className={`h-1 w-full ${r.bar}`} />
    </div>
  );
}

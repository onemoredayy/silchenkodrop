import { rarityColor } from "@/lib/rarity";
import { money } from "@/lib/format";
import SkinImage from "./SkinImage";

type Props = {
  name: string;
  rarity: string;
  image?: string | null;
  price?: number;
  wear?: string | null;
  chance?: number;
  footer?: React.ReactNode;
};

// Как в инвентаре CS2: цвет редкости — полоса снизу, без свечения
export default function ItemCard({ name, rarity, image, price, wear, chance, footer }: Props) {
  const [weapon, skin] = name.split(" | ");
  const color = rarityColor(rarity);
  return (
    <div className="flex flex-col overflow-hidden rounded-card border border-line bg-panel">
      <div className="relative aspect-[4/3] bg-raised/50 p-3">
        <SkinImage src={image} name={name} className="h-full w-full" />
        {chance != null && (
          <span className="absolute right-2 top-2 text-xs text-dust">{chance.toFixed(chance < 1 ? 2 : 1)}%</span>
        )}
      </div>
      <div className="h-[3px]" style={{ background: color }} />
      <div className="flex flex-1 flex-col gap-0.5 p-3">
        <div className="truncate text-xs text-dust">{weapon}</div>
        <div className="truncate text-sm font-medium" title={name}>
          {skin ?? weapon}
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-2 text-sm">
          {price != null && <span>{money(price)}</span>}
          {wear && <span className="truncate text-xs text-dust">{wearRu(wear)}</span>}
        </div>
        {footer && <div className="mt-2">{footer}</div>}
      </div>
    </div>
  );
}

const WEAR_RU: Record<string, string> = {
  "Factory New": "Прямо с завода",
  "Minimal Wear": "Немного поношенное",
  "Field-Tested": "После полевых",
  "Well-Worn": "Поношенное",
  "Battle-Scarred": "Закалённое в боях",
};
export function wearRu(w: string) {
  return WEAR_RU[w] ?? w;
}

import { rarityColor } from "@/lib/rarity";
import { money } from "@/lib/format";
import SkinImage from "./SkinImage";

type Drop = { id: string; user: string; item: string; rarity: string; image: string | null; price: number };

// Живая лента последних выпадений (реальные данные из базы)
export default function DropTicker({ drops }: { drops: Drop[] }) {
  if (drops.length === 0) {
    return (
      <div className="panel px-4 py-3 text-sm text-dust">
        Здесь будут появляться последние дропы. Открой первый кейс.
      </div>
    );
  }
  const loop = drops.length < 6 ? drops : [...drops, ...drops];
  return (
    <div className="overflow-hidden rounded-card border border-line bg-panel" aria-label="Последние дропы">
      <div className={`flex w-max ${drops.length < 6 ? "" : "ticker"}`}>
        {loop.map((d, i) => (
          <div
            key={`${d.id}-${i}`}
            className="flex w-56 shrink-0 items-center gap-3 border-r border-line px-3 py-2"
            style={{ boxShadow: `inset 0 -3px 0 ${rarityColor(d.rarity)}` }}
          >
            <SkinImage src={d.image} name={d.item} className="h-10 w-14 shrink-0" />
            <div className="min-w-0 text-xs">
              <div className="truncate text-bone">{d.item}</div>
              <div className="truncate text-dust">
                {d.user}, {money(d.price)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

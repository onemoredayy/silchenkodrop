import Link from "next/link";
import { rarityColor } from "@/lib/rarity";
import { money } from "@/lib/format";
import SkinImage from "./SkinImage";

type Drop = { id: string; user: string; userId: string; item: string; rarity: string; image: string | null; price: number };

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
          <Link
            key={`${d.id}-${i}`}
            href={`/u/${d.userId}`}
            title={`Профиль ${d.user}`}
            className="flex w-44 hover:bg-raised/60 shrink-0 items-center gap-2 border-r border-line px-2 py-2 sm:w-56 sm:gap-3 sm:px-3"
            style={{ boxShadow: `inset 0 -3px 0 ${rarityColor(d.rarity)}` }}
          >
            <SkinImage src={d.image} name={d.item} className="h-9 w-12 shrink-0 sm:h-10 sm:w-14" />
            <div className="min-w-0 text-xs">
              <div className="truncate text-bone">{d.item}</div>
              <div className="truncate text-dust">
                {d.user}, {money(d.price)}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

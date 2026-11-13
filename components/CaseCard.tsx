import Link from "next/link";
import { money } from "@/lib/format";
import SkinImage from "./SkinImage";

type Props = {
  slug: string;
  name: string;
  price: number;
  image?: string | null;
  topColors: string[];
  count: number;
};

export default function CaseCard({ slug, name, price, image, topColors, count }: Props) {
  return (
    <Link
      href={`/case/${slug}`}
      className="group flex flex-col overflow-hidden rounded-card border border-line bg-panel hover:border-stencil"
    >
      <div className="relative aspect-[5/4] bg-raised/40 p-6">
        <SkinImage src={image} name={name} className="h-full w-full transition-transform duration-300 group-hover:scale-105" />
      </div>
      {/* какие редкости лежат внутри — полоска сегментов */}
      <div className="flex h-1">
        {topColors.map((c, i) => (
          <span key={i} className="flex-1" style={{ background: c }} />
        ))}
      </div>
      <div className="flex items-end justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="truncate font-display text-lg leading-tight">{name}</div>
          <div className="text-xs text-dust">{count} предметов</div>
        </div>
        <div className="whitespace-nowrap rounded bg-stencil px-2.5 py-1 text-sm font-semibold text-ground">
          {money(price)}
        </div>
      </div>
    </Link>
  );
}

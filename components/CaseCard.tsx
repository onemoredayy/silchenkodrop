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
      <div className="relative aspect-[5/4] bg-raised/40 p-3 sm:p-6">
        <SkinImage src={image} name={name} className="h-full w-full transition-transform duration-300 group-hover:scale-105" />
      </div>
      {/* какие редкости лежат внутри — полоска сегментов */}
      <div className="flex h-1">
        {topColors.map((c, i) => (
          <span key={i} className="flex-1" style={{ background: c }} />
        ))}
      </div>
      <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-end sm:justify-between sm:gap-3 sm:p-4">
        <div className="min-w-0">
          <div className="truncate font-display text-base leading-tight sm:text-lg">{name}</div>
          <div className="text-xs text-dust">{count} предметов</div>
        </div>
        <div className="self-start whitespace-nowrap rounded bg-stencil px-2.5 py-1 text-sm font-semibold text-ground sm:self-auto">
          {money(price)}
        </div>
      </div>
    </Link>
  );
}

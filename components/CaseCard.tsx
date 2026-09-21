import Link from "next/link";

export type CaseCardData = {
  slug: string;
  name: string;
  description: string;
  price: number;
  image: string;
  itemsCount: number;
};

export default function CaseCard({ data }: { data: CaseCardData }) {
  return (
    <Link
      href={`/case/${data.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition hover:-translate-y-1 hover:border-violet-500/60 hover:shadow-lg hover:shadow-violet-900/30"
    >
      <div className="relative flex h-40 items-center justify-center bg-gradient-to-br from-violet-900/60 via-indigo-900/40 to-background">
        <span className="text-3xl font-black tracking-widest text-violet-300/70">CS2</span>
        {data.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.image}
            alt={data.name}
            className="absolute inset-0 h-full w-full object-contain p-4 transition group-hover:scale-105"
          />
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="text-lg font-semibold">{data.name}</h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{data.description}</p>

        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-xs text-muted-foreground">{data.itemsCount} предметов</span>
          <span className="rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-1 text-sm font-semibold text-white">
            {data.price.toLocaleString("ru-RU")} ₽
          </span>
        </div>
      </div>
    </Link>
  );
}

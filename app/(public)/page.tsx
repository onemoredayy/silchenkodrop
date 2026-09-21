import { prisma } from "@/lib/prisma";
import CaseCard from "@/components/CaseCard";

// Страница берёт данные из базы при каждом заходе
export const dynamic = "force-dynamic";

function Hero() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-violet-950 via-indigo-950 to-background px-6 py-12 text-center sm:py-16">
      <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-4xl font-black text-white">
        С
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
      </div>
      <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
        Сильченко<span className="text-violet-400">Дроп</span>
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
        Открывай кейсы CS2, выбивай редкие скины и собирай инвентарь.
        Пет-проект для друзей.
      </p>
    </section>
  );
}

export default async function HomePage() {
  const cases = await prisma.case.findMany({
    where: { isActive: true },
    orderBy: { price: "asc" },
    include: { _count: { select: { items: true } } },
  });

  return (
    <div className="space-y-10">
      <Hero />

      <section>
        <h2 className="mb-4 text-2xl font-bold">Кейсы</h2>

        {cases.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-6 text-muted-foreground">
            Кейсов пока нет. Запусти заполнение базы: npx prisma db seed
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cases.map((c) => (
              <CaseCard
                key={c.id}
                data={{
                  slug: c.slug,
                  name: c.name,
                  description: c.description,
                  price: c.price,
                  image: c.image,
                  itemsCount: c._count.items,
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

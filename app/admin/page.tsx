import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function money(n: number): string {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

export default async function AdminOverviewPage() {
  const [users, cases, items, openings, spent, sold, inventoryUnsold] =
    await Promise.all([
      prisma.user.count(),
      prisma.case.count(),
      prisma.item.count(),
      prisma.opening.count(),
      prisma.opening.aggregate({ _sum: { pricePaid: true } }),
      prisma.inventoryItem.aggregate({
        where: { isSold: true },
        _sum: { soldPrice: true },
      }),
      prisma.inventoryItem.findMany({
        where: { isSold: false },
        select: { item: { select: { price: true } } },
      }),
    ]);

  const revenue = spent._sum.pricePaid ?? 0;
  const paidOut = sold._sum.soldPrice ?? 0;
  const inventoryValue = inventoryUnsold.reduce((s, r) => s + r.item.price, 0);

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <Stat label="Игроков" value={String(users)} />
      <Stat label="Кейсов создано" value={String(cases)} />
      <Stat label="Предметов создано" value={String(items)} />
      <Stat label="Кейсов открыто" value={String(openings)} />
      <Stat label="Выручка с открытий" value={`${money(revenue)} ₽`} />
      <Stat label="Выплачено за продажи" value={`${money(paidOut)} ₽`} />
      <Stat label="Стоимость скинов у игроков" value={`${money(inventoryValue)} ₽`} />
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import ItemCard from "@/components/ItemCard";
import SteamLoginButton from "@/components/SteamLoginButton";

export const dynamic = "force-dynamic";

function money(n: number): string {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

async function loadStats(userId: string) {
  const [openings, spent, best, unsold, sold] = await Promise.all([
    prisma.opening.count({ where: { userId } }),
    prisma.opening.aggregate({ where: { userId }, _sum: { pricePaid: true } }),
    prisma.opening.findFirst({
      where: { userId },
      orderBy: { item: { price: "desc" } },
      include: { item: true },
    }),
    prisma.inventoryItem.findMany({
      where: { userId, isSold: false },
      select: { item: { select: { price: true } } },
    }),
    prisma.inventoryItem.aggregate({
      where: { userId, isSold: true },
      _sum: { soldPrice: true },
      _count: true,
    }),
  ]);

  return {
    openings,
    spent: spent._sum.pricePaid ?? 0,
    bestItem: best?.item ?? null,
    inventoryCount: unsold.length,
    inventoryValue: unsold.reduce((s, r) => s + r.item.price, 0),
    soldCount: sold._count,
    soldTotal: sold._sum.soldPrice ?? 0,
  };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

type HeaderUser = {
  username: string;
  avatar: string | null;
  createdAt: Date;
  role: string;
  steamId: string;
};

function Header({ user }: { user: HeaderUser }) {
  const since = user.createdAt.toLocaleDateString("ru-RU", {
    timeZone: "Europe/Moscow",
  });
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5">
      <span className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-700 text-3xl font-bold text-white">
        С
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={user.avatar || "/avatar.png"}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      </span>
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-black">{user.username}</h1>
        <p className="text-sm text-muted-foreground">
          На сайте с {since}
          {user.role === "ADMIN" ? " · админ" : ""}
        </p>
        
<a
          href={`https://steamcommunity.com/profiles/${user.steamId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-violet-300 underline underline-offset-4"
        >
          Профиль в Steam
        </a>
      </div>
    </div>
  );
}

type Stats = Awaited<ReturnType<typeof loadStats>>;

function StatsGrid({ balance, s }: { balance: number; s: Stats }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold">Статистика</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Баланс" value={`${money(balance)} ₽`} />
        <Stat label="Открыто кейсов" value={String(s.openings)} />
        <Stat label="Потрачено на кейсы" value={`${money(s.spent)} ₽`} />
        <Stat label="Скинов в инвентаре" value={String(s.inventoryCount)} />
        <Stat label="Стоимость инвентаря" value={`${money(s.inventoryValue)} ₽`} />
        <Stat
          label="Продано скинов"
          value={`${s.soldCount} на ${money(s.soldTotal)} ₽`}
        />
      </div>
    </section>
  );
}

function BestDrop({ s }: { s: Stats }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold">Лучший дроп</h2>
      {s.bestItem ? (
        <div className="h-52 w-44">
          <ItemCard item={s.bestItem} />
        </div>
      ) : (
        <p className="rounded-xl border border-border bg-card p-5 text-muted-foreground">
          Пока нет открытий. Открой свой первый кейс!
        </p>
      )}
    </section>
  );
}

export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="text-2xl font-bold">Профиль</h1>
        <p className="text-muted-foreground">Войди через Steam, чтобы увидеть профиль.</p>
        <div className="flex justify-center">
          <SteamLoginButton />
        </div>
      </div>
    );
  }

  const s = await loadStats(user.id);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Header user={user} />
      <StatsGrid balance={user.balance} s={s} />
      <BestDrop s={s} />
    </div>
  );
}

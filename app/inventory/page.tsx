import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { calcSellPrice, getSettings } from "@/lib/market";
import ItemCard from "@/components/ItemCard";
import SellButton from "@/components/SellButton";
import SteamLoginButton from "@/components/SteamLoginButton";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="text-2xl font-bold">Инвентарь</h1>
        <p className="text-muted-foreground">Войди через Steam, чтобы увидеть свои скины.</p>
        <div className="flex justify-center">
          <SteamLoginButton />
        </div>
      </div>
    );
  }

  if (user.isBanned) {
    return (
      <p className="rounded-xl border border-border bg-card p-6 text-red-400">
        Аккаунт заблокирован.
      </p>
    );
  }

  const [rows, settings] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { userId: user.id, isSold: false },
      include: { item: true },
      orderBy: { acquiredAt: "desc" },
    }),
    getSettings(),
  ]);

  const list = rows.map((r) => ({
    id: r.id,
    item: r.item,
    sellPrice: calcSellPrice(r.item.price, settings.sellCommission),
  }));
  const total = list.reduce((sum, r) => sum + r.sellPrice, 0);
  const percent = Math.round(settings.sellCommission * 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Инвентарь</h1>
          <p className="text-sm text-muted-foreground">
            Предметов: {list.length} · при продаже комиссия {percent}%
          </p>
        </div>
        {list.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Всё можно продать за{" "}
            <span className="font-semibold text-violet-300">
              {total.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽
            </span>
          </p>
        ) : null}
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="mb-4 text-muted-foreground">Инвентарь пуст. Открой свой первый кейс!</p>
          <Link href="/" className="text-violet-300 underline underline-offset-4">
            К кейсам
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {list.map((r) => (
            <div key={r.id} className="space-y-2">
              <div className="h-48">
                <ItemCard item={r.item} />
              </div>
              <SellButton inventoryId={r.id} sellPrice={r.sellPrice} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

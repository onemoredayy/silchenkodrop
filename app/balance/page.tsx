import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import SteamLoginButton from "@/components/SteamLoginButton";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const AMOUNTS = [500, 1000, 5000, 10000];

const TYPE_LABEL: Record<string, string> = {
  DEPOSIT: "Пополнение",
  OPEN_CASE: "Открытие кейса",
  SELL_ITEM: "Продажа скина",
  ADMIN_GRANT: "Выдача от админа",
};

// ЗАГЛУШКА пополнения: деньги начисляются без оплаты.
// Для настоящих платежей заменить тело этой функции на создание счёта
// и начислять баланс только после подтверждения от платёжной системы.
async function deposit(formData: FormData) {
  "use server";
  const user = await requireUser();

  const amount = Number(formData.get("amount"));
  if (!AMOUNTS.includes(amount)) return;
  if (!rateLimit(`deposit:${user.id}`, 5, 10_000).ok) return;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { balance: { increment: amount } },
    }),
    prisma.transaction.create({
      data: {
        userId: user.id,
        type: "DEPOSIT",
        amount,
        meta: JSON.stringify({ mock: true }),
      },
    }),
  ]);

  revalidatePath("/", "layout");
}

function money(n: number): string {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

export default async function BalancePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="text-2xl font-bold">Баланс</h1>
        <p className="text-muted-foreground">Войди через Steam, чтобы пополнять баланс.</p>
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

  const history = await prisma.transaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Баланс</h1>
        <p className="mt-2 text-4xl font-black text-violet-300">{money(user.balance)} ₽</p>
      </div>

      <section className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold">Пополнение</h2>
        <p className="text-sm text-muted-foreground">
          Тестовый режим: деньги начисляются сразу и бесплатно.
        </p>
        <form action={deposit} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {AMOUNTS.map((a) => (
            <Button key={a} type="submit" name="amount" value={a} variant="secondary">
              +{money(a)} ₽
            </Button>
          ))}
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">История операций</h2>
        {history.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-5 text-muted-foreground">
            Операций пока нет.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {history.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{TYPE_LABEL[t.type] ?? t.type}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.createdAt.toLocaleString("ru-RU", {
                      dateStyle: "short",
                      timeStyle: "short",
                      timeZone: "Europe/Moscow",
                    })}
                  </p>
                </div>
                <span
                  className={`font-semibold ${t.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}
                >
                  {t.amount >= 0 ? "+" : "−"}
                  {money(Math.abs(t.amount))} ₽
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

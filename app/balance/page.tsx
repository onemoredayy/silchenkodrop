import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { dateTime, money } from "@/lib/format";
import { TX_LABEL, txDetails } from "@/lib/tx";
import { activatePromo } from "./actions";

export const dynamic = "force-dynamic";

export default async function BalancePage({ searchParams }: { searchParams: { msg?: string; error?: string } }) {
  const user = await requireUser();
  const txs = await prisma.transaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });

  return (
    <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
      <section className="space-y-4">
        <h1 className="h1">Баланс</h1>
        <div className="panel p-5">
          <div className="text-sm text-dust">Сейчас на счёте</div>
          <div className="font-display text-4xl">{money(user.balance)}</div>
        </div>
        <div className="panel space-y-2 p-5">
          <div className="font-medium">Пополнить</div>
          <p className="text-sm text-dust">Пополнение скоро появится. Пока баланс можно получить промокодом или у администратора.</p>
          {user.depositBonus > 0 && (
            <p className="text-sm text-ok">
              Активен бонус +{user.depositBonus}% к следующему пополнению (промокод {user.depositPromo}).
            </p>
          )}
        </div>
        <form action={activatePromo} className="panel space-y-3 p-5">
          <div className="font-medium">Промокод</div>
          {searchParams.msg && <p className="text-sm text-ok">{searchParams.msg}</p>}
          {searchParams.error && <p className="text-sm text-danger">{searchParams.error}</p>}
          <div className="flex gap-2">
            <input name="code" placeholder="Введи промокод" autoComplete="off" autoCapitalize="characters" className="input uppercase" />
            <button className="btn-primary shrink-0">Активировать</button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="h2 mb-4">История</h2>
        {txs.length === 0 ? (
          <div className="panel p-6 text-dust">Операций пока не было.</div>
        ) : (
          <div className="panel overflow-x-auto px-4">
            <table className="table">
              <thead>
                <tr>
                  <th>Когда</th>
                  <th>Что</th>
                  <th>Подробности</th>
                  <th className="text-right">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {txs.map((t) => (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap text-dust">{dateTime(t.createdAt)}</td>
                    <td className="whitespace-nowrap">{TX_LABEL[t.type] ?? t.type}</td>
                    <td className="max-w-[18rem] truncate text-dust">{txDetails(t.type, t.meta)}</td>
                    <td className={`whitespace-nowrap text-right ${t.amount >= 0 ? "text-ok" : ""}`}>
                      {t.amount >= 0 ? "+" : "−"}
                      {money(Math.abs(t.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

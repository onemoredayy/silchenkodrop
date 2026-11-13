import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { dateTime, money } from "@/lib/format";
import { TX_LABEL, txDetails } from "@/lib/tx";
import { mockDeposit } from "./actions";

export const dynamic = "force-dynamic";

const PRESETS = [100, 500, 1000, 5000];

export default async function BalancePage() {
  const user = await requireUser();
  const [{ depositBonus }, txs] = await Promise.all([
    getSettings(),
    prisma.transaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  return (
    <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
      <section className="space-y-4">
        <h1 className="h1">Баланс</h1>
        <div className="panel p-5">
          <div className="text-sm text-dust">Сейчас на счёте</div>
          <div className="font-display text-4xl">{money(user.balance)}</div>
        </div>
        <form action={mockDeposit} className="panel space-y-3 p-5">
          <div className="font-medium">Пополнить</div>
          <p className="text-sm text-dust">
            Оплаты пока нет: деньги зачисляются сразу и ненастоящие.
            {depositBonus > 0 && ` Бонус к пополнению +${depositBonus}%.`}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map((p) => (
              <button key={p} name="amount" value={p} className="btn-ghost h-9 px-0 text-xs">
                {p.toLocaleString("ru-RU")} ₽
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input name="amount" type="number" min={10} max={100000} placeholder="Своя сумма" className="input" />
            <button className="btn-primary">Пополнить</button>
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

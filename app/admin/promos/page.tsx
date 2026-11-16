import { prisma } from "@/lib/prisma";
import { dateTime } from "@/lib/format";
import { PROMO_KINDS } from "@/lib/promo";
import Notice from "@/components/Notice";
import { createPromo, deletePromo, togglePromo } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPromos({ searchParams }: { searchParams: { error?: string; ok?: string } }) {
  const promos = await prisma.promo.findMany({ orderBy: { createdAt: "desc" } });
  const now = new Date();
  return (
    <div className="space-y-6">
      <h1 className="h1">Промокоды</h1>
      <Notice {...searchParams} />

      <form action={createPromo} className="panel grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_200px_120px_120px_120px_auto] lg:items-end">
        <label className="space-y-1">
          <span className="text-xs text-dust">Код</span>
          <input name="code" required placeholder="SILCHENKO2026" autoComplete="off" className="input uppercase" />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-dust">Тип</span>
          <select name="kind" className="input">
            {Object.entries(PROMO_KINDS).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-dust">Сколько (₽ или %)</span>
          <input name="value" type="number" step="0.01" min="0.01" required className="input" />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-dust">Активаций (0 — ∞)</span>
          <input name="maxUses" type="number" min="0" defaultValue={10} className="input" />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-dust">Дней (0 — бессрочно)</span>
          <input name="days" type="number" min="0" defaultValue={0} className="input" />
        </label>
        <button className="btn-primary">Создать</button>
        <p className="text-xs text-dust sm:col-span-2 lg:col-span-6">
          «На баланс» — деньги зачисляются сразу. «Бонус к пополнению» — игрок получит +% к следующему пополнению.
          Каждый игрок может активировать один промокод только один раз.
        </p>
      </form>

      <div className="panel overflow-x-auto px-4">
        <table className="table">
          <thead>
            <tr><th>Код</th><th>Тип</th><th className="text-right">Значение</th><th className="text-right">Активаций</th><th>До</th><th>Статус</th><th /></tr>
          </thead>
          <tbody>
            {promos.length === 0 && (
              <tr><td colSpan={7} className="text-dust">Промокодов пока нет.</td></tr>
            )}
            {promos.map((p) => {
              const expired = p.expiresAt && p.expiresAt < now;
              const used = p.maxUses > 0 && p.uses >= p.maxUses;
              const status = !p.isActive ? "Выключен" : expired ? "Истёк" : used ? "Закончился" : "Работает";
              return (
                <tr key={p.id}>
                  <td className="font-medium">{p.code}</td>
                  <td className="whitespace-nowrap text-dust">{p.kind === "BALANCE" ? "На баланс" : "К пополнению"}</td>
                  <td className="text-right">{p.kind === "BALANCE" ? `${p.value} ₽` : `+${p.value}%`}</td>
                  <td className="text-right">{p.uses}{p.maxUses > 0 ? ` / ${p.maxUses}` : ""}</td>
                  <td className="whitespace-nowrap text-dust">{p.expiresAt ? dateTime(p.expiresAt) : "—"}</td>
                  <td className={status === "Работает" ? "text-ok" : "text-dust"}>{status}</td>
                  <td className="whitespace-nowrap text-right">
                    <form action={togglePromo} className="inline">
                      <input type="hidden" name="id" value={p.id} />
                      <button className="text-sm text-dust hover:text-bone">{p.isActive ? "Выключить" : "Включить"}</button>
                    </form>
                    <form action={deletePromo} className="ml-3 inline">
                      <input type="hidden" name="id" value={p.id} />
                      <button className="text-sm text-danger hover:underline">Удалить</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

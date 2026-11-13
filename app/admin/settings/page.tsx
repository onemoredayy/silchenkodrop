import { getSettings } from "@/lib/settings";
import Notice from "@/components/Notice";
import { saveSettings } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminSettings({ searchParams }: { searchParams: { error?: string; ok?: string } }) {
  const s = await getSettings();
  const fields = [
    { key: "sellCommission", label: "Комиссия при продаже скина, %", hint: "Игрок получает цену скина минус этот процент.", value: s.sellCommission },
    { key: "margin", label: "Маржа для подсказки цены кейса, %", hint: "Только подсказка в редакторе кейса. Цену кейса ты ставишь сам.", value: s.margin },
    { key: "depositBonus", label: "Бонус к тестовому пополнению, %", hint: "0 — без бонуса.", value: s.depositBonus },
  ];
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="h1">Настройки</h1>
      <Notice {...searchParams} />
      <form action={saveSettings} className="panel space-y-5 p-5">
        {fields.map((f) => (
          <label key={f.key} className="block space-y-1">
            <span className="text-sm">{f.label}</span>
            <input name={f.key} type="number" step="0.1" min="0" max="100" defaultValue={f.value} className="input" />
            <span className="block text-xs text-dust">{f.hint}</span>
          </label>
        ))}
        <button className="btn-primary">Сохранить</button>
      </form>
    </div>
  );
}

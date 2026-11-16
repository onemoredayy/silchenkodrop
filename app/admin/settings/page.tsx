import { getSettings } from "@/lib/settings";
import Notice from "@/components/Notice";
import { saveSettings } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminSettings({ searchParams }: { searchParams: { error?: string; ok?: string } }) {
  const s = await getSettings();
  const fields = [
    { key: "sellCommission", label: "Комиссия при продаже скина, %", hint: "Игрок получает цену скина минус этот процент.", value: s.sellCommission },
    { key: "margin", label: "Маржа для подсказки цены кейса, %", hint: "Только подсказка в редакторе кейса. Цену кейса ты ставишь сам.", value: s.margin },
    { key: "depositBonus", label: "Бонус ко всем пополнениям, %", hint: "0 — без бонуса. Складывается с бонусом от промокода.", value: s.depositBonus },
    { key: "trollChance", label: "Шанс пук-прокрутки, %", hint: "Лента встаёт на самый дорогой предмет и докручивается на выпавший. 0 — выключить.", value: s.trollChance },
    { key: "upgradeEdge", label: "Преимущество сайта в апгрейдах, %", hint: "Шанс = ставка / цель × (100% − это число).", value: s.upgradeEdge },
    { key: "upgradeMaxChance", label: "Максимальный шанс апгрейда, %", hint: "", value: s.upgradeMaxChance },
    { key: "contractReturn", label: "Средняя отдача контракта, %", hint: "90 — в среднем игрок получает 90% от стоимости вложенных скинов. Выпадает от 20% до 500%.", value: s.contractReturn },
    { key: "usdRub", label: "Курс доллара для цен, ₽", hint: "Цены берутся в долларах. 0 — курс ЦБ автоматически.", value: s.usdRub },
  ];
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="h1">Настройки</h1>
      <Notice {...searchParams} />
      <form action={saveSettings} className="panel space-y-5 p-5">
        {fields.map((f) => (
          <label key={f.key} className="block space-y-1">
            <span className="text-sm">{f.label}</span>
            <input name={f.key} type="number" step="0.1" min="0" max={f.key === "usdRub" ? 1000 : 100} defaultValue={f.value} className="input" />
            <span className="block text-xs text-dust">{f.hint}</span>
          </label>
        ))}
        <button className="btn-primary">Сохранить</button>
      </form>
    </div>
  );
}

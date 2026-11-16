import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { itemPrice } from "@/lib/pricing";
import { ago, money } from "@/lib/format";
import Contractor from "@/components/Contractor";

export const dynamic = "force-dynamic";

export default async function ContractPage() {
  const user = await requireUser();
  const [{ contractReturn }, inv, history] = await Promise.all([
    getSettings(),
    prisma.inventoryItem.findMany({
      where: { userId: user.id, isSold: false },
      orderBy: { acquiredAt: "desc" },
      include: { item: { include: { catalog: true } } },
    }),
    prisma.contract.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { result: true },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="h1">Контракты</h1>
        <p className="mt-2 max-w-2xl text-dust">
          Кладёшь от 3 до 10 своих скинов и получаешь взамен один случайный скин. Он может стоить от 20% до 500% от
          вложенного.
        </p>
      </div>
      <Contractor
        ret={contractReturn}
        inventory={inv.map((r) => ({
          id: r.id,
          name: r.item.name,
          rarity: r.item.rarity,
          image: r.item.image,
          wear: r.item.wear,
          price: itemPrice(r.item),
        }))}
      />
      {history.length > 0 && (
        <section>
          <h2 className="h2 mb-3">Мои контракты</h2>
          <div className="panel divide-y divide-line">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-3 px-3 py-2 text-sm sm:px-4">
                <span className="hidden w-28 text-dust sm:inline">
                  {h.inputCount} шт. · {money(h.inputValue)}
                </span>
                <span className="min-w-0 flex-1 truncate">{h.result.name}</span>
                <span className={`w-24 text-right ${h.resultPrice >= h.inputValue ? "text-ok" : ""}`}>{money(h.resultPrice)}</span>
                <span className="w-12 text-right text-dust">{ago(h.createdAt)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

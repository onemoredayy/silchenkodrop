"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";

export default function SellButton({ ids, all, label, total }: { ids?: string[]; all?: boolean; label?: string; total: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function sell() {
    if (all && !confirm(`Продать все предметы за ${money(total)}?`)) return;
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/inventory/sell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(all ? { all: true } : { ids }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(data.error ?? "Ошибка");
    router.refresh();
  }

  return (
    <>
      <button onClick={sell} disabled={busy} className={all ? "btn-primary" : "btn-ghost h-8 w-full px-2 text-xs"}>
        {busy ? "Продаю…" : label ?? `Продать за ${money(total)}`}
      </button>
      {err && <span className="mt-1 block text-xs text-danger">{err}</span>}
    </>
  );
}

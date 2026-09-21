"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function SellButton({
  inventoryId,
  sellPrice,
}: {
  inventoryId: string;
  sellPrice: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sell() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/inventory/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Не удалось продать");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сети");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={sell}
        className="w-full"
      >
        {busy ? "Продаём..." : `Продать за ${sellPrice.toLocaleString("ru-RU")} ₽`}
      </Button>
      {error ? <p className="text-center text-xs text-red-400">{error}</p> : null}
    </div>
  );
}

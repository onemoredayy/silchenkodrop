"use client";

import { useEffect, useState } from "react";

const PING_MS = 45_000;

export default function OnlineBadge({ initial }: { initial: number }) {
  const [n, setN] = useState(initial);

  useEffect(() => {
    let stop = false;
    const ping = async () => {
      if (document.visibilityState !== "visible") return;
      const r = await fetch("/api/online", { method: "POST" }).catch(() => null);
      if (!stop && r?.ok) setN((await r.json()).online);
    };
    ping();
    const t = setInterval(ping, PING_MS);
    document.addEventListener("visibilitychange", ping);
    return () => {
      stop = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", ping);
    };
  }, []);

  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-dust" title="Сейчас на сайте">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
      </span>
      <span className="text-bone">{n}</span>
      <span className="hidden md:inline">онлайн</span>
    </span>
  );
}

// Запускается один раз при старте сервера: цены обновляются сами каждые 6 часов.
const EVERY_MS = 6 * 60 * 60 * 1000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as unknown as { __pricesTimer?: boolean };
  if (g.__pricesTimer) return;
  g.__pricesTimer = true;

  const { prisma } = await import("./lib/prisma");
  const { updateAllPrices } = await import("./lib/prices");

  async function tick() {
    try {
      const last = await prisma.siteSetting.findUnique({ where: { key: "pricesUpdatedAt" } });
      const age = last ? Date.now() - new Date(last.value).getTime() : Infinity;
      if (age >= EVERY_MS - 60_000) await updateAllPrices(prisma, (m) => console.log(`[цены] ${m}`));
    } catch (e) {
      console.error("[цены] не удалось обновить:", (e as Error).message);
    }
  }

  setTimeout(tick, 20_000);
  setInterval(tick, 30 * 60 * 1000); // проверяем раз в полчаса, обновляем раз в 6 часов
}

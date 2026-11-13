import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "./prisma";
import { SESSION_COOKIE, verifySession } from "./session";

export const getCurrentUser = cache(async () => {
  const payload = await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  return prisma.user.findUnique({ where: { id: payload.uid } });
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/");
  return user;
}

// Адрес сайта берётся из запроса (работает за nginx/Caddy через X-Forwarded-*).
// APP_URL в .env нужен, только если хочешь задать его жёстко.
export function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto")?.split(",")[0] ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function adminSteamIds() {
  return (process.env.ADMIN_STEAM_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

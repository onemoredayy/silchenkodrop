import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminSteamIds, appUrl } from "@/lib/auth";
import { fetchSteamProfile, verifySteamResponse } from "@/lib/steam";
import { SESSION_COOKIE, SESSION_TTL_SEC, signSession } from "@/lib/session";

const SEED_ADMIN = "76561198000000000"; // тестовый админ из seed

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const base = appUrl();
  const steamId = await verifySteamResponse(
    req.nextUrl.searchParams,
    `${base}/api/auth/steam/callback`,
  );
  if (!steamId) return NextResponse.redirect(`${base}/login?error=steam`);

  const profile = await fetchSteamProfile(steamId);
  // Админ: из ADMIN_STEAM_IDS или просто первый, кто вошёл на сайт
  const realAdmins = await prisma.user.count({
    where: { role: "ADMIN", steamId: { not: SEED_ADMIN } },
  });
  const isAdmin = adminSteamIds().includes(steamId) || realAdmins === 0;

  const user = await prisma.user.upsert({
    where: { steamId },
    update: {
      lastLoginAt: new Date(),
      ...(profile?.username ? { username: profile.username } : {}),
      ...(profile?.avatar ? { avatar: profile.avatar } : {}),
      ...(isAdmin ? { role: "ADMIN" } : {}),
    },
    create: {
      steamId,
      username: profile?.username ?? `Игрок ${steamId.slice(-4)}`,
      avatar: profile?.avatar ?? null,
      role: isAdmin ? "ADMIN" : "USER",
    },
  });

  const res = NextResponse.redirect(`${base}/`);
  res.cookies.set(SESSION_COOKIE, await signSession(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: base.startsWith("https://"),
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
  return res;
}

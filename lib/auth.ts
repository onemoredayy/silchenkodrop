/* eslint-disable @typescript-eslint/no-explicit-any */
import NextAuth from "next-auth";
import SteamProvider from "authjs-steam-provider";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth((req) => ({
  trustHost: true, // нужно для Codespaces и любых прокси
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    SteamProvider(req as any, {
      clientSecret: process.env.STEAM_API_KEY!,
      callbackUrl: `${process.env.NEXTAUTH_URL}/api/auth/callback`,
    }),
  ],
  callbacks: {
    // profile приходит только в момент входа
    async jwt({ token, profile }) {
      const p = profile as any;
      if (p?.steamid) {
        const steamId = String(p.steamid); // 64-бит: только строка
        const username = p.personaname ?? "Игрок";
        const avatar = p.avatarfull ?? null;
        const user = await prisma.user.upsert({
          where: { steamId },
          update: { username, avatar },
          create: { steamId, username, avatar },
        });
        token.userId = user.id;
        token.steamId = steamId;
        token.role = user.role;
        token.name = username;
        token.picture = avatar;
        token.email = `${steamId}@steamcommunity.com`;
      }
      return token;
    },
    async session({ session, token }) {
      const u = session.user as any;
      if (u && token.userId) {
        u.id = token.userId;
        u.steamId = token.steamId;
        u.role = token.role;
      }
      return session;
    },
  },
}));

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Текущий пользователь из базы (или null, если не вошёл)
export async function getCurrentUser(): Promise<User | null> {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
}

// Для API: вошёл и не забанен
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Нужно войти через Steam", 401);
  if (user.isBanned) throw new AuthError("Аккаунт заблокирован", 403);
  return user;
}

// Для админских страниц и API
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new AuthError("Нет доступа", 403);
  return user;
}

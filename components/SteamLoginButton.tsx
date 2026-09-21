"use client";

import { signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export default function SteamLoginButton() {
  return (
    <Button
      onClick={() => signIn("steam", { callbackUrl: "/" })}
      className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500"
    >
      Войти через Steam
    </Button>
  );
}

export function LogoutButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => signOut({ callbackUrl: "/" })}
    >
      Выйти
    </Button>
  );
}

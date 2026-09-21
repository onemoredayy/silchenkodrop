import { signIn, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default function SteamLoginButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("steam", { redirectTo: "/" });
      }}
    >
      <Button
        type="submit"
        className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500"
      >
        Войти через Steam
      </Button>
    </form>
  );
}

export function LogoutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <Button type="submit" variant="ghost" size="sm">
        Выйти
      </Button>
    </form>
  );
}

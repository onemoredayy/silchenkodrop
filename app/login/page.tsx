import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  if (await getCurrentUser()) redirect("/");
  return (
    <div className="mx-auto max-w-md py-16">
      <h1 className="h1">Вход</h1>
      <p className="mt-3 text-dust">
        Входим только через Steam: сайт получает твой SteamID, ник и аватар. Пароль Steam сюда не попадает.
      </p>
      {searchParams.error && (
        <p className="mt-4 rounded border border-danger/50 px-3 py-2 text-sm text-danger">
          Steam не подтвердил вход. Попробуй ещё раз.
        </p>
      )}
      <a href="/api/auth/steam/login" className="btn-primary mt-6 w-full">
        Войти через Steam
      </a>
    </div>
  );
}

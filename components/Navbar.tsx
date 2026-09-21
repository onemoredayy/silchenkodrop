import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import SteamLoginButton, { LogoutButton } from "@/components/SteamLoginButton";

const LINKS = [
  { href: "/", label: "Кейсы" },
  { href: "/inventory", label: "Инвентарь" },
  { href: "/balance", label: "Баланс" },
  { href: "/profile", label: "Профиль" },
];

// Буква "С" лежит под картинкой: если файла нет, картинка
// не отображается (alt пустой), и остаётся буква
function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 font-bold text-white">
        С
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
      </span>
      <span className="text-lg font-bold tracking-tight">
        Сильченко<span className="text-violet-400">Дроп</span>
      </span>
    </Link>
  );
}

function Avatar({ src }: { src?: string | null }) {
  return (
    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-700 text-sm font-semibold text-white">
      С
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src || "/avatar.png"} alt="" className="absolute inset-0 h-full w-full object-cover" />
    </span>
  );
}

export default async function Navbar() {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "ADMIN";
  const links = isAdmin ? [...LINKS, { href: "/admin", label: "Админка" }] : LINKS;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Logo />

        <nav className="order-3 flex w-full gap-1 overflow-x-auto md:order-none md:w-auto">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/balance"
                className="rounded-full border border-border bg-card px-3 py-1 text-sm font-semibold text-violet-300"
              >
                {user.balance.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽
              </Link>
              <Link href="/profile" className="flex items-center gap-2">
                <Avatar src={user.avatar} />
                <span className="hidden max-w-[120px] truncate text-sm sm:block">
                  {user.username}
                </span>
              </Link>
              <LogoutButton />
            </>
          ) : (
            <SteamLoginButton />
          )}
        </div>
      </div>
    </header>
  );
}

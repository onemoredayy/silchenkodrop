import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { money } from "@/lib/format";
import Avatar from "./Avatar";
import OnlineBadge from "./OnlineBadge";
import { shownOnline } from "@/lib/online";

const links = [
  { href: "/", label: "Кейсы" },
  { href: "/battles", label: "Батлы" },
  { href: "/upgrade", label: "Апгрейд" },
  { href: "/contract", label: "Контракты" },
  { href: "/market", label: "Каталог" },
];
// на телефоне внизу только главное; каталог и админка — в профиле
const mobileLinks = [
  { href: "/", label: "Кейсы" },
  { href: "/battles", label: "Батлы" },
  { href: "/upgrade", label: "Апгрейд" },
  { href: "/contract", label: "Контракты" },
];

export default async function Navbar() {
  const user = await getCurrentUser();
  return (
    <header className="border-b border-line bg-ground">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-6">
        <Link href="/" className="font-display text-lg leading-none text-bone">
          Сильченко<span className="text-stencil">Дроп</span>
        </Link>
        <nav className="hidden gap-4 text-sm sm:flex lg:gap-5">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-dust hover:text-bone">
              {l.label}
            </Link>
          ))}
          {user?.role === "ADMIN" && (
            <Link href="/admin" className="text-dust hover:text-bone">
              Админка
            </Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <OnlineBadge initial={shownOnline()} />
          {user ? (
            <>
              <Link href="/balance" className="whitespace-nowrap rounded border border-line px-2.5 py-1.5 text-sm hover:border-stencil sm:px-3">
                {money(user.balance)}
              </Link>
              <Link href="/profile" className="flex items-center gap-2 text-sm" title="Профиль">
                <Avatar src={user.avatar} name={user.username} />
                <span className="hidden max-w-[10rem] truncate md:inline">{user.username}</span>
              </Link>
            </>
          ) : (
            <a href="/api/auth/steam/login" className="btn-primary h-9 px-3 sm:px-4">
              Войти<span className="hidden sm:inline"> через Steam</span>
            </a>
          )}
        </div>
      </div>
      {/* мобильная навигация: панель вкладок внизу экрана, под большой палец */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-ground/95 backdrop-blur sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {[...mobileLinks, { href: user ? "/profile" : "/api/auth/steam/login", label: user ? "Профиль" : "Войти" }].map(
          (l) => (
            // вход через Steam — обычная ссылка, без предзагрузки Next
            <a
              key={l.href}
              href={l.href}
              className="flex h-14 min-w-0 flex-1 items-center justify-center px-1 text-center text-[13px] leading-tight text-dust active:text-stencil"
            >
              <span className="truncate">{l.label}</span>
            </a>
          ),
        )}
      </nav>
    </header>
  );
}

import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { money } from "@/lib/format";
import Avatar from "./Avatar";

const links = [
  { href: "/", label: "Кейсы" },
  { href: "/upgrade", label: "Апгрейд" },
  { href: "/market", label: "Каталог" },
  { href: "/inventory", label: "Инвентарь" },
];

export default async function Navbar() {
  const user = await getCurrentUser();
  return (
    <header className="border-b border-line bg-ground">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="font-display text-lg leading-none text-bone">
          Сильченко<span className="text-stencil">Дроп</span>
        </Link>
        <nav className="hidden gap-5 text-sm sm:flex">
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
          {user ? (
            <>
              <Link href="/balance" className="rounded border border-line px-3 py-1.5 text-sm hover:border-stencil">
                {money(user.balance)}
              </Link>
              <Link href="/profile" className="flex items-center gap-2 text-sm" title="Профиль">
                <Avatar src={user.avatar} name={user.username} />
                <span className="hidden max-w-[10rem] truncate md:inline">{user.username}</span>
              </Link>
            </>
          ) : (
            <a href="/api/auth/steam/login" className="btn-primary h-9">
              Войти через Steam
            </a>
          )}
        </div>
      </div>
      {/* мобильная навигация */}
      <nav className="flex gap-5 overflow-x-auto border-t border-line px-4 py-2 text-sm sm:hidden">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="whitespace-nowrap text-dust">
            {l.label}
          </Link>
        ))}
        {user && (
          <Link href="/profile" className="whitespace-nowrap text-dust">
            Профиль
          </Link>
        )}
        {user?.role === "ADMIN" && (
          <Link href="/admin" className="whitespace-nowrap text-dust">
            Админка
          </Link>
        )}
      </nav>
    </header>
  );
}

import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "Сводка" },
  { href: "/admin/sections", label: "Блоки" },
  { href: "/admin/cases", label: "Кейсы" },
  { href: "/admin/items", label: "Предметы" },
  { href: "/admin/users", label: "Игроки" },
  { href: "/admin/promos", label: "Промокоды" },
  { href: "/admin/settings", label: "Настройки" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="grid gap-4 md:grid-cols-[180px_1fr] md:gap-6">
      <aside>
        <div className="mb-3 font-display text-lg">Админка</div>
        <nav className="no-scrollbar -mx-3 flex gap-1 overflow-x-auto px-3 md:mx-0 md:flex-col md:px-0">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded px-3 py-2 text-sm text-dust hover:bg-panel hover:text-bone">
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

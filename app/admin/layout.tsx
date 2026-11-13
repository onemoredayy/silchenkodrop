import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "Сводка" },
  { href: "/admin/cases", label: "Кейсы" },
  { href: "/admin/items", label: "Предметы" },
  { href: "/admin/users", label: "Игроки" },
  { href: "/admin/settings", label: "Настройки" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="grid gap-6 md:grid-cols-[180px_1fr]">
      <aside>
        <div className="mb-3 font-display text-lg">Админка</div>
        <nav className="flex gap-1 overflow-x-auto md:flex-col">
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

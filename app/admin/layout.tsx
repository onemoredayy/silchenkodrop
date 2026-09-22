import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const TABS = [
  { href: "/admin", label: "Обзор" },
  { href: "/admin/cases", label: "Кейсы" },
  { href: "/admin/items", label: "Предметы" },
  { href: "/admin/users", label: "Пользователи" },
  { href: "/admin/settings", label: "Настройки" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Вход только для админов. Действия внутри страниц проверяют роль отдельно
  const user = await getCurrentUser();
  if (!user || user.isBanned || user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Админка</h1>
        <nav className="mt-3 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="whitespace-nowrap rounded-md border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition hover:border-violet-500/60 hover:text-foreground"
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}

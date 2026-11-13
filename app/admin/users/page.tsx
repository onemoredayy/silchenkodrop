import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { money } from "@/lib/format";
import Avatar from "@/components/Avatar";
import { grantBalance, toggleAdmin, toggleBan } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminUsers({ searchParams }: { searchParams: { q?: string } }) {
  const me = await getCurrentUser();
  const q = (searchParams.q ?? "").trim();
  const users = await prisma.user.findMany({
    where: q ? { OR: [{ username: { contains: q } }, { steamId: { contains: q } }] } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { _count: { select: { openings: true } } },
  });
  return (
    <div className="space-y-4">
      <h1 className="h1">Игроки</h1>
      <form>
        <input name="q" defaultValue={q} placeholder="Ник или SteamID" className="input max-w-sm" />
      </form>
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className={`panel flex flex-wrap items-center gap-4 p-3 ${u.isBanned ? "opacity-60" : ""}`}>
            <Avatar src={u.avatar} name={u.username} size={40} />
            <div className="min-w-[10rem] flex-1">
              <div className="font-medium">
                {u.username}
                {u.role === "ADMIN" && <span className="ml-2 text-xs text-stencil">админ</span>}
                {u.isBanned && <span className="ml-2 text-xs text-danger">заблокирован</span>}
              </div>
              <div className="text-xs text-dust">
                {u.steamId}, открытий: {u._count.openings}
              </div>
            </div>
            <div className="w-28 text-right">{money(u.balance)}</div>
            <form action={grantBalance} className="flex gap-2">
              <input type="hidden" name="userId" value={u.id} />
              <input name="amount" type="number" step="0.01" placeholder="± сумма" className="input h-9 w-28" />
              <input name="note" placeholder="за что" className="input h-9 w-28" />
              <button className="btn-ghost h-9">Начислить</button>
            </form>
            {u.id !== me?.id && (
              <div className="flex gap-2">
                <form action={toggleBan}>
                  <input type="hidden" name="userId" value={u.id} />
                  <button className={u.isBanned ? "btn-ghost h-9" : "btn-danger h-9"}>{u.isBanned ? "Разбанить" : "Забанить"}</button>
                </form>
                <form action={toggleAdmin}>
                  <input type="hidden" name="userId" value={u.id} />
                  <button className="btn-ghost h-9">{u.role === "ADMIN" ? "Снять админа" : "Сделать админом"}</button>
                </form>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

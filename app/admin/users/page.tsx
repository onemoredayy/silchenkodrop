import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

function money(n: number): string {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

async function grantBalance(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const userId = String(formData.get("userId"));
  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount) || amount === 0) return;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { balance: { increment: amount } },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: "ADMIN_GRANT",
        amount,
        meta: JSON.stringify({ byAdminId: admin.id }),
      },
    }),
  ]);
  revalidatePath("/admin/users");
}

async function toggleBan(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const userId = String(formData.get("userId"));
  const isBanned = formData.get("isBanned") === "1";
  if (userId === admin.id) throw new Error("Нельзя забанить самого себя");
  await prisma.user.update({ where: { id: userId }, data: { isBanned: !isBanned } });
  revalidatePath("/admin/users");
}

async function toggleAdmin(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const userId = String(formData.get("userId"));
  const role = String(formData.get("role"));
  if (userId === admin.id) throw new Error("Нельзя снять админку с самого себя");
  await prisma.user.update({
    where: { id: userId },
    data: { role: role === "ADMIN" ? "USER" : "ADMIN" },
  });
  revalidatePath("/admin/users");
}

export default async function AdminUsersPage() {
  const [me, users] = await Promise.all([
    getCurrentUser(),
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Пользователи</h2>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Игрок</th>
              <th className="px-4 py-2">Баланс</th>
              <th className="px-4 py-2">Роль</th>
              <th className="px-4 py-2">Статус</th>
              <th className="px-4 py-2">Выдать баланс</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => {
              const isMe = u.id === me?.id;
              return (
                <tr key={u.id}>
                  <td className="px-4 py-2">
                    <p className="font-medium">
                      {u.username}
                      {isMe ? <span className="ml-1 text-xs text-muted-foreground">(ты)</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">{u.steamId}</p>
                  </td>
                  <td className="px-4 py-2">{money(u.balance)} ₽</td>
                  <td className="px-4 py-2">
                    <form action={toggleAdmin}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="role" value={u.role} />
                      <button
                        type="submit"
                        disabled={isMe}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold disabled:opacity-50 ${
                          u.role === "ADMIN"
                            ? "bg-violet-500/20 text-violet-300"
                            : "bg-zinc-500/20 text-zinc-400"
                        }`}
                      >
                        {u.role === "ADMIN" ? "Админ" : "Игрок"}
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-2">
                    <form action={toggleBan}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="isBanned" value={u.isBanned ? "1" : "0"} />
                      <button
                        type="submit"
                        disabled={isMe}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold disabled:opacity-50 ${
                          u.isBanned
                            ? "bg-red-500/20 text-red-400"
                            : "bg-emerald-500/20 text-emerald-400"
                        }`}
                      >
                        {u.isBanned ? "Забанен" : "Активен"}
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-2">
                    <form action={grantBalance} className="flex gap-1">
                      <input type="hidden" name="userId" value={u.id} />
                      <input
                        name="amount"
                        type="number"
                        step="0.01"
                        placeholder="±₽"
                        className="w-24 rounded-md border border-border bg-background px-2 py-1 text-sm"
                      />
                      <button
                        type="submit"
                        className="rounded-md bg-secondary px-2 py-1 text-xs"
                      >
                        Выдать
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
                          }

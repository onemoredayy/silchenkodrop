import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ago, money } from "@/lib/format";
import { parseCaseIds } from "@/lib/battle";
import Avatar from "@/components/Avatar";
import SkinImage from "@/components/SkinImage";
import BattleCreator from "@/components/BattleCreator";

export const dynamic = "force-dynamic";

export default async function BattlesPage() {
  const user = await getCurrentUser();
  const [cases, open, done] = await Promise.all([
    prisma.case.findMany({
      where: { isActive: true, items: { some: {} } },
      orderBy: [{ price: "asc" }],
      select: { id: true, name: true, image: true, price: true },
    }),
    prisma.battle.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { players: { orderBy: { slot: "asc" }, include: { user: { select: { username: true, avatar: true } } } } },
    }),
    prisma.battle.findMany({
      where: { status: "DONE" },
      orderBy: { finishedAt: "desc" },
      take: 10,
      include: { winner: { select: { username: true, avatar: true } }, players: { select: { total: true } } },
    }),
  ]);
  const caseImg = new Map(cases.map((c) => [c.id, c]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="h1">Батлы</h1>
        <p className="mt-2 max-w-2xl text-dust">
          От 2 до 4 игроков открывают одни и те же кейсы. У кого выпало дороже в сумме, тот забирает все скины.
        </p>
      </div>

      <BattleCreator cases={cases} loggedIn={!!user} balance={user?.balance ?? 0} />

      <section>
        <h2 className="h2 mb-3">Ждут игроков</h2>
        {open.length === 0 ? (
          <div className="panel p-4 text-sm text-dust">Открытых комнат нет. Создай свою и позови друзей.</div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {open.map((b) => {
              const ids = parseCaseIds(b.caseIds);
              return (
                <Link key={b.id} href={`/battles/${b.id}`} className="panel flex flex-col gap-3 p-3 hover:border-stencil sm:p-4">
                  <div className="flex items-center gap-2">
                    {Array.from({ length: b.maxPlayers }, (_, i) => {
                      const p = b.players.find((x) => x.slot === i);
                      return p ? (
                        <Avatar key={i} src={p.user.avatar} name={p.user.username} size={32} />
                      ) : (
                        <span key={i} className="grid h-8 w-8 place-items-center rounded border border-dashed border-line text-dust">
                          ?
                        </span>
                      );
                    })}
                    <span className="ml-auto text-sm text-dust">
                      {b.players.length}/{b.maxPlayers}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 overflow-hidden">
                    {ids.slice(0, 8).map((id, i) => (
                      <SkinImage key={i} src={caseImg.get(id)?.image} name={caseImg.get(id)?.name ?? ""} className="h-9 w-11 shrink-0" />
                    ))}
                    {ids.length > 8 && <span className="text-sm text-dust">+{ids.length - 8}</span>}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-dust">{ids.length} кейс(ов) · {ago(b.createdAt)} назад</span>
                    <span className="rounded bg-stencil px-2 py-0.5 font-semibold text-ground">{money(b.cost)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="h2 mb-3">Последние батлы</h2>
          <div className="panel divide-y divide-line">
            {done.map((b) => (
              <Link key={b.id} href={`/battles/${b.id}`} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-raised/40 sm:px-4">
                {b.winner && <Avatar src={b.winner.avatar} name={b.winner.username} size={24} />}
                <span className="min-w-0 flex-1 truncate">
                  {b.winner?.username ?? "—"} <span className="text-dust">забрал всё</span>
                </span>
                <span>{money(b.players.reduce((s, p) => s + p.total, 0))}</span>
                <span className="w-12 text-right text-dust">{b.finishedAt ? ago(b.finishedAt) : ""}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

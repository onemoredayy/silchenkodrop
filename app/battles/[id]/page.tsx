import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { battleView } from "@/lib/battle";
import BattleRoom from "@/components/BattleRoom";

export const dynamic = "force-dynamic";

export default async function BattleRoomPage({ params }: { params: { id: string } }) {
  const [view, user] = await Promise.all([battleView(params.id), getCurrentUser()]);
  if (!view) notFound();
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="h1">Батл</h1>
        <Link href="/battles" className="text-sm text-dust hover:text-bone">
          ← Все батлы
        </Link>
      </div>
      <BattleRoom
        initial={view}
        me={user ? { id: user.id, balance: user.balance, isAdmin: user.role === "ADMIN" } : null}
      />
    </div>
  );
}

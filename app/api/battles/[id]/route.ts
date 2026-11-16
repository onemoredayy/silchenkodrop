import { NextResponse } from "next/server";
import { battleView } from "@/lib/battle";

export const dynamic = "force-dynamic";

// Состояние комнаты — страница опрашивает его, пока ждёт игроков
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const view = await battleView(params.id);
  if (!view) return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
  return NextResponse.json(view);
}

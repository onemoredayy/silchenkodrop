import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { catalogDisplayName } from "@/lib/upgrade";

export const dynamic = "force-dynamic";

// Цели для апгрейда: скины дороже ставки, по возрастанию цены
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const min = Math.max(0, Number(sp.get("min")) || 0);
  const q = (sp.get("q") ?? "").trim();
  const st = sp.get("st");
  const where: Prisma.SkinCatalogWhereInput = {
    price: { gt: min },
    ...(q ? { baseName: { contains: q } } : {}),
    ...(st === "0" ? { statTrak: false } : st === "1" ? { statTrak: true } : {}),
  };
  const rows = await prisma.skinCatalog.findMany({
    where,
    orderBy: { price: "asc" },
    take: 60,
    select: { marketHashName: true, baseName: true, statTrak: true, rarity: true, image: true, wear: true, price: true },
  });
  return NextResponse.json(rows.map((r) => ({ ...r, name: catalogDisplayName(r) })));
}

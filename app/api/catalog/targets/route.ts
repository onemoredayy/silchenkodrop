import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { catalogDisplayName } from "@/lib/upgrade";
import { EXTRA_CATEGORIES } from "@/lib/junk-cases";

export const dynamic = "force-dynamic";

const PER_PAGE = 9; // 3 ряда по 3 карточки

// Цели для апгрейда: скины дороже ставки, по возрастанию цены, постранично
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const min = Math.max(0, Number(sp.get("min")) || 0);
  const q = (sp.get("q") ?? "").trim();
  const st = sp.get("st");
  const page = Math.max(1, Math.floor(Number(sp.get("page"))) || 1);
  const where: Prisma.SkinCatalogWhereInput = {
    price: { gt: min },
    // наклейки, значки и прочая шелупонь целью апгрейда не бывают
    OR: [{ category: null }, { category: { notIn: EXTRA_CATEGORIES } }],
    ...(q ? { baseName: { contains: q } } : {}),
    ...(st === "0" ? { statTrak: false } : st === "1" ? { statTrak: true } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.skinCatalog.count({ where }),
    prisma.skinCatalog.findMany({
      where,
      orderBy: [{ price: "asc" }, { marketHashName: "asc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: { marketHashName: true, baseName: true, statTrak: true, rarity: true, image: true, wear: true, price: true },
    }),
  ]);
  return NextResponse.json({
    rows: rows.map((r) => ({ ...r, name: catalogDisplayName(r) })),
    total,
    pages: Math.max(1, Math.ceil(total / PER_PAGE)),
  });
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { shownOnline, touchOnline } from "@/lib/online";

export const dynamic = "force-dynamic";

// «Я на сайте» — раз в ~45 с из браузера. Отдаёт число для счётчика.
export async function POST() {
  const jar = cookies();
  let vid = jar.get("vid")?.value;
  const fresh = !vid || !/^[a-f0-9]{24}$/.test(vid);
  if (fresh) vid = randomBytes(12).toString("hex");
  const user = await getCurrentUser();
  touchOnline(vid!, user?.id ?? null);

  const res = NextResponse.json({ online: shownOnline() });
  if (fresh) {
    res.cookies.set("vid", vid!, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 365 * 86400, path: "/" });
  }
  return res;
}

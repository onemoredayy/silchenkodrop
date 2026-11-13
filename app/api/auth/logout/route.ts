import { NextResponse } from "next/server";
import { appUrl } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST() {
  const res = NextResponse.redirect(`${appUrl()}/`, { status: 303 });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

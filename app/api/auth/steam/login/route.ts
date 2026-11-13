import { NextResponse } from "next/server";
import { appUrl } from "@/lib/auth";
import { steamLoginUrl } from "@/lib/steam";

export const dynamic = "force-dynamic";

export function GET() {
  const base = appUrl();
  return NextResponse.redirect(steamLoginUrl(`${base}/api/auth/steam/callback`, base));
}

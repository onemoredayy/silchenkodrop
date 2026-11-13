import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Закрытые разделы. Роль ADMIN дополнительно проверяется в app/admin/layout.tsx
// и в каждом серверном действии админки.
export async function middleware(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Нужно войти через Steam" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/inventory/:path*",
    "/balance/:path*",
    "/profile/:path*",
    "/api/cases/:path*",
    "/api/inventory/:path*",
  ],
};

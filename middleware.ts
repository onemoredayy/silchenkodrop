import { getToken } from "next-auth/jwt"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export default async function middleware(req: NextRequest) {
  const isAdminRoute = req.nextUrl.pathname.startsWith("/admin")

  if (isAdminRoute) {
    const token = await getToken({
      req,
      secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    })

    console.log("MIDDLEWARE DEBUG token:", JSON.stringify(token))

    if (!token) {
      const loginUrl = new URL("/", req.nextUrl.origin)
      return NextResponse.redirect(loginUrl)
    }

    if (token.role !== "ADMIN") {
      const homeUrl = new URL("/", req.nextUrl.origin)
      return NextResponse.redirect(homeUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*"],
}

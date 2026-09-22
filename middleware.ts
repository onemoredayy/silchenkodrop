export const runtime = "nodejs"

import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isAdminRoute = req.nextUrl.pathname.startsWith("/admin")

  if (isAdminRoute) {
    const user = req.auth?.user as { role?: string } | undefined

    if (!user) {
      const loginUrl = new URL("/", req.nextUrl.origin)
      return NextResponse.redirect(loginUrl)
    }

    if (user.role !== "ADMIN") {
      const homeUrl = new URL("/", req.nextUrl.origin)
      return NextResponse.redirect(homeUrl)
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/admin/:path*"],
}

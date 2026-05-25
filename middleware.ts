import { getToken } from "next-auth/jwt"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow auth routes, public pages, and public intake links
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/intake/") ||
    pathname.startsWith("/api/intake/validate") ||
    pathname.startsWith("/api/intake/public-submit") ||
    pathname === "/login" ||
    pathname === "/"
  ) {
    return NextResponse.next()
  }

  const token = await getToken({ req: request })

  if (!token) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api(?!/auth)).*)",
  ],
}

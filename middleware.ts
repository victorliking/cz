import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * v1 auth middleware:
 * - Reads `?as=<userId>` from URL
 * - Stores it in a cookie so it persists across navigation
 * - Redirects based on role (agent → /agent, buyer → /buyer)
 *
 * Note: We can't do DB lookups in Edge middleware, so role-based
 * redirecting is handled at page level. Middleware just persists the
 * `as` param into a cookie.
 */
export function middleware(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const asParam = searchParams.get("as")

  // If ?as= param present, set cookie and strip from URL
  if (asParam) {
    const url = request.nextUrl.clone()
    url.searchParams.delete("as")

    const response = NextResponse.redirect(url)
    response.cookies.set("homematch_user", asParam, {
      path: "/",
      httpOnly: false, // needs to be readable client-side for dev
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
    return response
  }

  // For protected routes, check if user cookie exists
  const userId = request.cookies.get("homematch_user")?.value
  const pathname = request.nextUrl.pathname

  // Protected routes that require auth
  const protectedPaths = ["/agent", "/buyer"]
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p))

  if (isProtected && !userId) {
    const url = request.nextUrl.clone()
    url.pathname = "/switch"
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match all paths except static files, api, _next
    "/((?!_next/static|_next/image|favicon.ico|api).*)",
  ],
}

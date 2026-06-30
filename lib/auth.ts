import { getServerSession } from "next-auth"
import { getToken } from "next-auth/jwt"
import { authOptions } from "@/lib/auth-options"
import type { NextRequest } from "next/server"

// CANONICAL IDENTITY INVARIANT
// ----------------------------
// token.sub is the single source of truth for "who owns this data". Every row
// is created via an API route using getApiUser().id (= token.sub) as agentId
// (see app/api/buyers/route.ts, app/api/listings/route.ts). The session/jwt
// callbacks in auth-options.ts anchor token.id to token.sub, so:
//
//   getServerUserId() (server pages) === getApiUser().id (API routes) === agentId on rows
//
// Always use these helpers — never read session.user.id ad hoc — so reads
// (counts, lists) agree with how rows were written.

export async function getSessionUser() {
  const session = await getServerSession(authOptions)
  return session?.user ?? null
}

// Canonical user id for server components / pages. Mirrors getApiUser().id.
export async function getServerUserId() {
  const session = await getServerSession(authOptions)
  return session?.user?.id ?? null
}

export async function getApiUser(request: NextRequest) {
  const token = await getToken({ req: request })
  if (!token?.sub) return null
  return { id: token.sub, role: token.role as string }
}

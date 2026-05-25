import { getServerSession } from "next-auth"
import { getToken } from "next-auth/jwt"
import { authOptions } from "@/lib/auth-options"
import type { NextRequest } from "next/server"

export async function getSessionUser() {
  const session = await getServerSession(authOptions)
  return session?.user ?? null
}

export async function getApiUser(request: NextRequest) {
  const token = await getToken({ req: request })
  if (!token?.sub) return null
  return { id: token.sub, role: token.role as string }
}

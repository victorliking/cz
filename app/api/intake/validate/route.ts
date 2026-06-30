import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getApiUser } from "@/lib/auth"
import { createIntakeToken, verifyIntakeToken } from "@/lib/intake-token"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

/**
 * GET — public validation of an intake link.
 *
 * Requires a valid signed token (`t`) bound to the profileId. This stops
 * profile-id enumeration: without a token that matches the HMAC, the endpoint
 * reveals nothing (`{ valid: false }`).
 */
export async function GET(request: NextRequest) {
  const rl = rateLimit(`intake-validate:${getClientIp(request)}`, {
    limit: 30,
    windowMs: 60_000,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { valid: false, error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    )
  }

  const profileId = request.nextUrl.searchParams.get("profileId")
  const token = request.nextUrl.searchParams.get("t")

  if (!profileId) {
    return NextResponse.json({ valid: false })
  }

  // Fail-closed token check before any DB lookup.
  if (!verifyIntakeToken(profileId, token)) {
    return NextResponse.json({ valid: false }, { status: 403 })
  }

  const profile = await prisma.buyerProfile.findUnique({
    where: { id: profileId },
    include: { intakeResponse: true },
  })

  if (!profile) {
    return NextResponse.json({ valid: false })
  }

  return NextResponse.json({
    valid: true,
    alreadyCompleted: !!profile.intakeResponse?.completedAt,
  })
}

/**
 * POST — mint a signed intake link token.
 *
 * Used by the agent dashboard "Copy Link" action. Only an authenticated agent
 * who owns the buyer profile may mint a token, so tokens never leak to
 * unauthenticated callers.
 */
export async function POST(request: NextRequest) {
  const apiUser = await getApiUser(request)
  if (!apiUser?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const profileId = body?.profileId as string | undefined
  if (!profileId) {
    return NextResponse.json({ error: "Missing profileId" }, { status: 400 })
  }

  const profile = await prisma.buyerProfile.findUnique({
    where: { id: profileId },
    select: { id: true, agentId: true },
  })

  if (!profile || profile.agentId !== apiUser.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const token = createIntakeToken(profileId)
  if (!token) {
    return NextResponse.json(
      { error: "Intake link signing is not configured" },
      { status: 500 }
    )
  }

  return NextResponse.json({ token })
}

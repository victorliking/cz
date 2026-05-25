import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getApiUser } from "@/lib/auth"

/**
 * GET /api/insights?buyerProfileId=xxx
 * Returns non-dismissed insights for a buyer profile.
 * Only accessible by the agent who owns the buyer profile.
 *
 * POST /api/insights
 * Dismiss an insight by setting dismissedAt.
 * Body: { insightId: string }
 */

export async function GET(request: NextRequest) {
  const apiUser = await getApiUser(request)
  if (!apiUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const buyerProfileId = request.nextUrl.searchParams.get("buyerProfileId")
  if (!buyerProfileId) {
    return NextResponse.json({ error: "buyerProfileId required" }, { status: 400 })
  }

  // Verify agent owns this buyer profile
  const profile = await prisma.buyerProfile.findUnique({
    where: { id: buyerProfileId },
    select: { agentId: true },
  })

  if (!profile || profile.agentId !== apiUser.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const insights = await prisma.insightLog.findMany({
    where: {
      buyerProfileId,
      dismissedAt: null,
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ insights })
}

export async function POST(request: NextRequest) {
  const apiUser = await getApiUser(request)
  if (!apiUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = await request.json()
  const { insightId } = body

  if (!insightId) {
    return NextResponse.json({ error: "insightId required" }, { status: 400 })
  }

  // Verify agent owns the insight's buyer profile
  const insight = await prisma.insightLog.findUnique({
    where: { id: insightId },
    include: { buyerProfile: { select: { agentId: true } } },
  })

  if (!insight || insight.buyerProfile.agentId !== apiUser.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.insightLog.update({
    where: { id: insightId },
    data: { dismissedAt: new Date() },
  })

  return NextResponse.json({ success: true })
}

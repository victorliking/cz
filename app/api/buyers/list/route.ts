import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getApiUser } from "@/lib/auth"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

export async function GET(request: NextRequest) {
  const apiUser = await getApiUser(request)
  if (!apiUser?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const rl = rateLimit(`buyers-list:${apiUser.id ?? getClientIp(request)}`, {
    limit: 60,
    windowMs: 60_000,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    )
  }

  const buyers = await prisma.buyerProfile.findMany({
    where: { agentId: apiUser.id },
    include: { user: true, intakeResponse: true },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({
    buyers: buyers.map((b) => ({
      id: b.id,
      status: b.status,
      intakeCompletedAt: b.intakeCompletedAt,
      notes: b.notes,
      user: { name: b.user.name, email: b.user.email, phone: b.user.phone },
      intakeResponse: b.intakeResponse
        ? { completedAt: b.intakeResponse.completedAt }
        : null,
    })),
  })
}

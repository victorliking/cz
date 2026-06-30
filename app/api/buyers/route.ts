import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getApiUser } from "@/lib/auth"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  const apiUser = await getApiUser(request)
  if (!apiUser?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const rl = rateLimit(`buyers-create:${apiUser.id || getClientIp(request)}`, {
    limit: 20,
    windowMs: 60_000,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    )
  }

  const body = await request.json()
  const { name, email, phone, notes } = body

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 })
  }

  let user = await prisma.user.findUnique({ where: { email } })

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: name || null,
        phone: phone || null,
        role: "BUYER",
      },
    })
  }

  const existingProfile = await prisma.buyerProfile.findUnique({
    where: { userId: user.id },
  })

  if (existingProfile) {
    if (existingProfile.agentId !== apiUser.id) {
      return NextResponse.json({ error: "This buyer is managed by another agent" }, { status: 409 })
    }
    return NextResponse.json({ profileId: existingProfile.id, existing: true })
  }

  const profile = await prisma.buyerProfile.create({
    data: {
      userId: user.id,
      agentId: apiUser.id,
      notes: notes || null,
    },
  })

  return NextResponse.json({ profileId: profile.id, existing: false })
}

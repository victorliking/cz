import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getApiUser } from "@/lib/auth"

export async function POST(request: NextRequest) {
  const apiUser = await getApiUser(request)
  if (!apiUser?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
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

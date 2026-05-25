import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getApiUser } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const apiUser = await getApiUser(request)
  const userId = apiUser?.id
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let profile = await prisma.buyerProfile.findFirst({
    where: { userId },
  })

  if (!profile) {
    profile = await prisma.buyerProfile.create({
      data: { userId, agentId: userId },
    })
  }

  return NextResponse.json({ profileId: profile.id })
}

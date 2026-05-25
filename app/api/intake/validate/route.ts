import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const profileId = request.nextUrl.searchParams.get("profileId")

  if (!profileId) {
    return NextResponse.json({ valid: false })
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

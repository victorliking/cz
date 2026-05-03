import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generatePortrait } from "@/lib/portrait/generate-portrait"
import { matchListings } from "@/lib/scoring/match-engine"
import { MOCK_LISTINGS } from "@/lib/scoring/mock-listings"

export async function GET(request: NextRequest) {
  const userId = request.cookies.get("homematch_user")?.value
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const profile = await prisma.buyerProfile.findFirst({
    where: { userId },
    include: { intakeResponse: true },
  })

  if (!profile?.intakeResponse?.answers) {
    return NextResponse.json({ matches: [] })
  }

  const answers = profile.intakeResponse.answers as Record<string, any>
  const portrait = generatePortrait(answers)

  // In production: fetch listings from DB
  // For now: use mock listings
  const matches = matchListings(portrait, MOCK_LISTINGS)

  return NextResponse.json({ matches })
}

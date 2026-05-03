import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generatePortrait } from "@/lib/portrait/generate-portrait"

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
    return NextResponse.json({ portrait: null })
  }

  const answers = profile.intakeResponse.answers as Record<string, any>
  const portrait = generatePortrait(answers)

  return NextResponse.json({ portrait })
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generatePreferenceReport } from "@/lib/scoring/preference-report"
import type { PreferenceState } from "@/lib/scoring/bayesian-learner"

export async function GET(request: NextRequest) {
  const userId = request.cookies.get("homematch_user")?.value
  if (!userId) {
    return NextResponse.json({ report: null, feedbackCount: 0, hasEnoughData: false })
  }

  const profile = await prisma.buyerProfile.findFirst({
    where: { userId },
    include: { intakeResponse: true },
  })
  if (!profile?.intakeResponse) {
    return NextResponse.json({ report: null, feedbackCount: 0, hasEnoughData: false })
  }

  const answers = (profile.intakeResponse.answers as Record<string, unknown>) || {}
  const prefState = answers._preferenceState as PreferenceState | undefined

  if (!prefState) {
    return NextResponse.json({ report: null, feedbackCount: 0, hasEnoughData: false })
  }

  const hasEnoughData = prefState.evidenceCount >= 3

  if (!hasEnoughData) {
    return NextResponse.json({
      report: null,
      feedbackCount: prefState.evidenceCount,
      hasEnoughData: false,
    })
  }

  const report = generatePreferenceReport(prefState)

  return NextResponse.json({
    report,
    feedbackCount: prefState.evidenceCount,
    hasEnoughData: true,
  })
}

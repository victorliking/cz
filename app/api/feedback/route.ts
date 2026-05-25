import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  initializeFromIntake,
  updateWeights,
  extractSignalsFromFeedback,
  type PreferenceState,
  type FeedbackSignal,
} from "@/lib/scoring/bayesian-learner"
import { generatePreferenceReport } from "@/lib/scoring/preference-report"
import { generateInsights, type GeneratedInsight } from "@/lib/insights/generate-insights"
import type { FeedbackHistory } from "@/lib/insights/mismatch-detector"
import { getApiUser } from "@/lib/auth"

export interface ShowingFeedbackEntry {
  id: string
  address: string
  date: string
  liked: string
  disliked: string
  verdict: "love" | "like" | "neutral" | "dislike"
  notes: string
  adjustments: string
}

async function resolveProfileWithIntake(userId: string, buyerProfileId?: string | null) {
  if (buyerProfileId) {
    const profile = await prisma.buyerProfile.findUnique({
      where: { id: buyerProfileId },
      include: { intakeResponse: true },
    })
    if (!profile || profile.agentId !== userId) return null
    return profile
  }
  return prisma.buyerProfile.findFirst({
    where: { userId },
    include: { intakeResponse: true },
  })
}

// GET: Retrieve feedback entries
export async function GET(request: NextRequest) {
  const apiUser = await getApiUser(request)
  const userId = apiUser?.id
  if (!userId) return NextResponse.json({ entries: [] })

  const buyerProfileId = request.nextUrl.searchParams.get("buyerProfileId")
  const profile = await resolveProfileWithIntake(userId, buyerProfileId)
  if (!profile?.intakeResponse) return NextResponse.json({ entries: [] })

  const answers = (profile.intakeResponse.answers as Record<string, unknown>) || {}
  const entries = (answers._feedback || []) as ShowingFeedbackEntry[]

  return NextResponse.json({ entries })
}

// POST: Add new showing feedback + update Bayesian preference weights
export async function POST(request: NextRequest) {
  const apiUser = await getApiUser(request)
  const userId = apiUser?.id
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = await request.json()
  const { address, liked, disliked, verdict, notes, adjustments, listingDimensions, buyerProfileId } = body

  const profile = await resolveProfileWithIntake(userId, buyerProfileId)
  if (!profile?.intakeResponse) {
    return NextResponse.json({ error: "No profile or intake" }, { status: 404 })
  }

  const entry: ShowingFeedbackEntry = {
    id: `fb_${Date.now()}`,
    address: address || "",
    date: new Date().toISOString().split("T")[0],
    liked: liked || "",
    disliked: disliked || "",
    verdict: verdict || "neutral",
    notes: notes || "",
    adjustments: adjustments || "",
  }

  const answers = (profile.intakeResponse.answers as Record<string, unknown>) || {}
  const existing = (answers._feedback || []) as ShowingFeedbackEntry[]
  existing.unshift(entry)

  // --- Bayesian Preference Learning ---
  let prefState = answers._preferenceState as PreferenceState | undefined

  if (!prefState) {
    const priorities = (answers.priority_ranking as string[]) || []
    const RANK_WEIGHTS = [0.25, 0.20, 0.16, 0.13, 0.10, 0.07, 0.05, 0.04]
    const priorityObjects = priorities.map((item, idx) => ({
      item,
      rank: idx + 1,
      weight: RANK_WEIGHTS[idx] || 0.03,
    }))

    if (priorityObjects.length > 0) {
      prefState = initializeFromIntake(priorityObjects)
    }
  }

  let preferenceReport = null
  if (prefState && (liked || disliked)) {
    const dimensionSignals = extractSignalsFromFeedback({
      liked: liked || "",
      disliked: disliked || "",
      verdict: verdict || "neutral",
      listingDimensions: listingDimensions || {},
    })

    const signal: FeedbackSignal = {
      source: "FEEDBACK_CHIPS",
      dimensionSignals,
      listingId: entry.id,
      listingDimensions: listingDimensions || {},
      timestamp: new Date().toISOString(),
    }

    const { newState } = updateWeights(prefState, signal)
    prefState = newState

    if (prefState.evidenceCount >= 3) {
      preferenceReport = generatePreferenceReport(prefState)
    }
  }

  // Persist to IntakeResponse answers JSON
  const updatedAnswers = {
    ...answers,
    _feedback: existing,
    _preferenceState: prefState || undefined,
  }
  await prisma.intakeResponse.update({
    where: { id: profile.intakeResponse.id },
    data: { answers: updatedAnswers as any },
  })

  // --- Insight Generation (post Bayesian update) ---
  let newInsights: GeneratedInsight[] = []
  if (prefState && prefState.evidenceCount >= 3) {
    const priorityRanking = (answers.priority_ranking as string[]) || []
    const feedbackHistoryForInsights: FeedbackHistory[] = existing.map((f) => ({
      id: f.id,
      verdict: f.verdict,
      liked: f.liked,
      disliked: f.disliked,
      address: f.address,
    }))

    newInsights = await generateInsights({
      buyerProfileId: profile.id,
      preferenceState: prefState,
      intakeContext: {
        priorityRanking,
        budgetMax: profile.budgetMax,
        dealBreakers: (answers.pain_points as string[]) || [],
        targetCities: (answers.target_areas as string[]) || [],
      },
      feedbackHistory: feedbackHistoryForInsights,
    })
  }

  return NextResponse.json({
    entry,
    preferenceEvolution: preferenceReport ? {
      driftScore: preferenceReport.driftScore,
      driftLabel: preferenceReport.driftLabel,
      summary: preferenceReport.summary,
      currentWeights: preferenceReport.currentWeights,
      verificationQuestions: preferenceReport.verificationQuestions,
    } : null,
    insights: newInsights.length > 0 ? newInsights : null,
  })
}

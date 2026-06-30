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
import { rateLimit, getClientIp } from "@/lib/rate-limit"
import { resolveListingForFeedback } from "@/lib/recommendations/resolve-listing"
import type { GutReaction, Prisma } from "@prisma/client"

export interface ShowingFeedbackEntry {
  id: string
  address: string
  date: string
  liked: string
  disliked: string
  verdict: "love" | "like" | "neutral" | "dislike"
  notes: string
  adjustments: string
  /** List price of the shown home, when known — powers budget-drift detection. */
  listPrice?: number
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

  const rl = rateLimit(`feedback:${userId || getClientIp(request)}`, {
    limit: 30,
    windowMs: 60_000,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    )
  }

  const body = await request.json()
  const { address, liked, disliked, verdict, notes, adjustments, listingDimensions, buyerProfileId } = body
  // Optional real listing id + raw chip labels — used only by the additive
  // Feedback-table tracking below. The legacy _feedback/learning path ignores them.
  const bodyListingId = typeof body.listingId === "string" ? body.listingId : undefined
  const likedChips: string[] = Array.isArray(body.likedChips) ? body.likedChips : []
  const dislikedChips: string[] = Array.isArray(body.dislikedChips) ? body.dislikedChips : []
  // Price of the shown home, if the caller provides it (field name varies).
  const bodyListPrice =
    typeof body.listPrice === "number" ? body.listPrice
    : typeof body.price === "number" ? body.price
    : undefined

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
    ...(bodyListPrice !== undefined ? { listPrice: bodyListPrice } : {}),
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

  // --- Additive Feedback-table tracking (journey timeline) ---
  // Pin this feedback to a real listingId and record a structured Feedback row
  // so the recommendation journey timeline can read it. This is purely additive
  // on top of the _feedback JSON / Bayesian path above — any failure here must
  // never break that path, so the whole block is best-effort and swallowed.
  try {
    await recordFeedbackRow({
      buyerProfileId: profile.id,
      listingId: bodyListingId,
      address: entry.address,
      verdict: entry.verdict,
      notes: entry.notes,
      likedChips,
      dislikedChips,
    })
  } catch (err) {
    console.error("[feedback] additive Feedback-table tracking failed:", err)
  }

  // --- Insight Generation (post Bayesian update) ---
  let newInsights: GeneratedInsight[] = []
  if (prefState && prefState.evidenceCount >= 3) {
    const priorityRanking = (answers.priority_ranking as string[]) || []

    // Resolve list prices for budget-drift detection. Entries created by the
    // showing form only carry an address, so backfill missing prices by matching
    // the entry address against the agent's listings (one batched query).
    const priceByAddress = await resolvePricesByAddress(userId, existing)

    const feedbackHistoryForInsights: FeedbackHistory[] = existing.map((f) => ({
      id: f.id,
      verdict: f.verdict,
      liked: f.liked,
      disliked: f.disliked,
      address: f.address,
      listPrice: f.listPrice ?? priceByAddress.get(normalizeAddress(f.address)),
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

/**
 * Map the lightweight verdict to the Feedback.gutReaction enum.
 * The form only emits love/like/neutral/dislike; "neutral" maps to MEH.
 * (The schema also has HATE, but the form never produces it.)
 */
const VERDICT_TO_GUT_REACTION: Record<string, GutReaction> = {
  love: "LOVE",
  like: "LIKE",
  neutral: "MEH",
  dislike: "DISLIKE",
}

function verdictToGutReaction(verdict: string): GutReaction {
  return VERDICT_TO_GUT_REACTION[verdict] ?? "MEH"
}

/**
 * Best-effort: resolve the real listing for a feedback entry, write a structured
 * Feedback table row, and stamp the matching Recommendation as shown. Callers
 * wrap this in try/catch — it must not affect the legacy learning path.
 */
async function recordFeedbackRow(args: {
  buyerProfileId: string
  listingId?: string
  address?: string
  verdict: string
  notes?: string
  likedChips: string[]
  dislikedChips: string[]
}): Promise<void> {
  const { buyerProfileId, verdict, notes, likedChips, dislikedChips } = args

  const listingId = await resolveListingForFeedback(buyerProfileId, {
    listingId: args.listingId,
    address: args.address,
  })
  // No real listing to attribute to — leave the legacy path as the only record.
  if (!listingId) return

  const oneLineReaction = notes && notes.trim().length > 0 ? notes.trim() : null
  const shownChips = { liked: likedChips, disliked: dislikedChips }

  await prisma.feedback.create({
    data: {
      buyerProfileId,
      listingId,
      gutReaction: verdictToGutReaction(verdict),
      oneLineReaction,
      shownChips: shownChips as Prisma.InputJsonValue,
      likedDimensions: likedChips,
      dislikedDimensions: dislikedChips,
    },
  })

  // Stamp the recommendation(s) for this buyer+listing as shown so the timeline
  // knows "recommended → shown → reacted". Only stamp ones not already stamped.
  await prisma.recommendation.updateMany({
    where: {
      listingId,
      shownToBuyerAt: null,
      batch: { buyerProfileId },
    },
    data: { shownToBuyerAt: new Date() },
  })
}

/** Normalize an address for loose matching (case/whitespace/punctuation insensitive). */
function normalizeAddress(address: string): string {
  return address.toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ").trim()
}

/**
 * Backfill list prices for feedback entries that lack one by matching their
 * address against the agent's listings. Returns a map of normalized address →
 * listPrice. Entries that already carry a price don't need a lookup.
 */
async function resolvePricesByAddress(
  agentId: string,
  entries: ShowingFeedbackEntry[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>()

  const missingAddresses = entries
    .filter((e) => e.listPrice === undefined && e.address.trim().length > 0)
    .map((e) => e.address.trim())
  if (missingAddresses.length === 0) return result

  const listings = await prisma.listing.findMany({
    where: {
      agentId,
      address: { in: missingAddresses, mode: "insensitive" as any },
    },
    select: { address: true, listPrice: true },
  })

  for (const listing of listings) {
    if (listing.listPrice > 0) {
      result.set(normalizeAddress(listing.address), listing.listPrice)
    }
  }
  return result
}

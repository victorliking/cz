import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generatePortrait } from "@/lib/portrait/generate-portrait"
import { matchListings, matchListingsEvolved, ListingForMatch, MatchResult } from "@/lib/scoring/match-engine"
import { getSchoolRatingNumber } from "@/lib/geo/school-ratings"
import { normalizeTargetCities } from "@/lib/data/ma-towns"
import { getSignificantChanges, isValidPreferenceState, type PreferenceState } from "@/lib/scoring/bayesian-learner"
import { getApiUser } from "@/lib/auth"
import { rateLimit, getClientIp } from "@/lib/rate-limit"
import { saveRecommendationBatch } from "@/lib/recommendations/persist"

export async function GET(request: NextRequest) {
  const apiUser = await getApiUser(request)
  const userId = apiUser?.id
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const rl = rateLimit(`matches:${userId ?? getClientIp(request)}`, {
    limit: 30,
    windowMs: 60_000,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    )
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

  // Read-time normalization: scrub the portrait's target cities against real MA
  // towns. New submits are already cleaned, but LEGACY rows (e.g. "1" stored
  // before intake validation existed) would otherwise become an impossible
  // `city IN ('1')` filter. This fixes them live, with no DB migration.
  const submittedAreas = Array.isArray(answers.target_areas) ? answers.target_areas.length : 0
  portrait.hardFilters.targetCities = normalizeTargetCities(portrait.hardFilters.targetCities)
  const usableCities = portrait.hardFilters.targetCities.length

  let relaxed = false
  let relaxedReason: string | undefined
  if (submittedAreas > 0 && usableCities === 0) {
    // They named area(s), but none mapped to a town we cover → honest message.
    relaxed = true
    relaxedReason = "We couldn't match your chosen area to a town we cover, so these are homes across the region within your budget. Update your areas in intake to refine."
  }

  // Progressively relax filters if we get too few results
  let dbListings = await fetchListings(portrait, 1.15, true)

  if (dbListings.length < 3) {
    // First relaxation: expand budget from 115% to 130%
    dbListings = await fetchListings(portrait, 1.30, true)
    if (dbListings.length >= 3) {
      relaxed = true
      // Don't clobber the more specific "couldn't match your area" message.
      relaxedReason = relaxedReason ?? "Expanded budget range to find more matches"
    }
  }

  if (dbListings.length < 3) {
    // Second relaxation: drop city filter entirely
    dbListings = await fetchListings(portrait, 1.30, false)
    relaxed = true
    relaxedReason = relaxedReason ?? "Expanded search area and budget to find more matches"
  }

  // Convert DB listings to match engine format
  const listings: ListingForMatch[] = dbListings.map(listing => {
    const vector = listing.vector as any || {}
    return {
      id: listing.id,
      address: listing.address,
      city: listing.city,
      price: listing.listPrice,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathroomsFull + listing.bathroomsHalf * 0.5,
      sqft: listing.interiorSqft || 0,
      yearBuilt: listing.yearBuilt || 0,
      propertyType: listing.propertyType,
      dimensions: {
        natural_light: vector.natural_light || undefined,
        noise_level: vector.noise_level || undefined,
        openness: vector.openness || undefined,
        school_rating: vector.school_rating || getSchoolRatingNumber(listing.city),
        walk_score: vector.walk_score || undefined,
        yard_usability: vector.yard_usability || undefined,
        move_in_readiness: vector.move_in_readiness || undefined,
        // Map privacy_from_neighbors (vector key) → privacy (engine key)
        privacy: vector.privacy_from_neighbors || vector.privacy || undefined,
        // Map finish_quality enum OR kitchen_quality score → kitchen_quality number
        kitchen_quality: vector.kitchen_quality
          || (vector.finish_quality
            ? ({ builder_grade: 2, mid: 3, high_end: 4, luxury: 5 } as Record<string, number>)[vector.finish_quality]
            : undefined),
        // Map commute_minutes_primary (vector key) → commute_primary (engine key)
        commute_primary: vector.commute_minutes_primary || vector.commute_primary || undefined,
        commute_secondary: vector.commute_minutes_secondary || vector.commute_secondary || undefined,
        style: vector.style || vector._mls?.style || undefined,
        street_type: vector.street_type || undefined,
        // AI-classified visual style tags (set by /api/classify); enables computeStyleMatchScore
        style_tags: vector.style_tags || undefined,
      },
      imageUrl: listing.photos?.[0] || undefined,
      description: listing.agentNotes || undefined,
    }
  })

  // --- Close the learning loop ---
  // Load the buyer's evolved preference state (written by /api/feedback into the
  // IntakeResponse.answers._preferenceState sub-key). When it exists AND has
  // accumulated evidence, rank with the evolved weights; otherwise cold-start
  // with the static intake weights.
  const prefState = isValidPreferenceState(answers._preferenceState) ? answers._preferenceState : undefined
  const learningActive = !!prefState && prefState.evidenceCount > 0

  // Always compute the intake-weight ranking — it's the baseline we diff against
  // to explain how learning re-ranked the list.
  const intakeMatches = matchListings(portrait, listings)
  const matches = learningActive
    ? matchListingsEvolved(portrait, listings, prefState!)
    : intakeMatches

  // --- Explain the re-rank ---
  // Build the response matches, attaching rankBoost to listings that climbed
  // meaningfully versus the intake-weight ranking.
  let learning: LearningSummary | null = null
  let rankedMatches: Array<MatchResult & { rankBoost?: RankBoost }> = matches

  if (learningActive) {
    const intakePositions = new Map<string, number>()
    intakeMatches.forEach((m, idx) => intakePositions.set(m.listing.id, idx))

    // Dimensions whose weight rose vs the intake prior — these drove the boosts.
    const risingDimensions = getSignificantChanges(prefState!)
      .filter((c) => c.direction === "increased")

    rankedMatches = matches.map((m, evolvedIdx) => {
      const intakeIdx = intakePositions.get(m.listing.id)
      if (intakeIdx === undefined) return m

      const movedUp = intakeIdx - evolvedIdx
      // Only annotate listings that climbed at least 2 positions — keeps the
      // "we moved this up because..." callouts meaningful, not noisy.
      if (movedUp < 2) return m

      const reason = buildRankBoostReason(m, risingDimensions)
      if (!reason) return m

      return { ...m, rankBoost: { movedUp, reason } }
    })

    learning = {
      active: true,
      evidenceCount: prefState!.evidenceCount,
      summary: buildLearningSummary(prefState!.evidenceCount),
      shifts: buildShifts(prefState!),
    }
  }

  // Attach display fields the buyer UI needs (full photo gallery + the real
  // external listing link) by joining back to the original DB rows by id.
  // match-engine's ListingForMatch only carries imageUrl, so we enrich here at
  // response-build time rather than widening the engine type.
  const dbById = new Map(dbListings.map((l) => [l.id, l]))
  const responseMatches = rankedMatches.slice(0, 20).map((m) => {
    const dbListing = dbById.get(m.listing.id)
    return {
      ...m,
      // Flat fields the agent UI POSTs verbatim to /api/recommendations when it
      // persists a batch. Kept alongside the existing nested `listing`/score so
      // the buyer-facing match cards are unaffected.
      listingId: m.listing.id,
      rationale: {
        verdict: m.verdict,
        reasons: m.reasons,
        concerns: m.concerns,
        dimensionScores: m.dimensionScores,
      },
      listing: {
        ...m.listing,
        photos: dbListing?.photos ?? [],
        listingUrl: dbListing?.listingUrl ?? null,
      },
    }
  })

  // --- Persist a recommendation batch (guarded, additive) ---
  // Snapshot the top recommendations into the RecommendationBatch history so the
  // agent's journey timeline reflects what was actually recommended over time.
  // Guarded so repeatedly viewing matches doesn't spam rows: only save when the
  // top set's listing ids differ from the most recent batch (or none exists).
  // Fire-and-forget + try/catch so it can NEVER break the matches response.
  const topForBatch = responseMatches.slice(0, 10)
  if (topForBatch.length > 0) {
    persistBatchIfChanged(profile.id, topForBatch).catch((e) =>
      console.error("[matches] recommendation batch persist failed:", e)
    )
  }

  // Return top 20 matches
  return NextResponse.json({
    matches: responseMatches,
    totalConsidered: dbListings.length,
    totalMatched: matches.length,
    relaxed,
    relaxedReason: relaxedReason ?? null,
    learning,
  })
}

/**
 * Save a recommendation batch only if the top set changed since the last one.
 * Compares the ordered listing-id signature against the most recent batch for
 * this buyer, so identical re-views are no-ops but a new/re-ranked set is
 * captured. Never throws (callers fire-and-forget).
 */
async function persistBatchIfChanged(
  buyerProfileId: string,
  top: Array<{ listingId: string; score: number; rationale: any }>
): Promise<void> {
  const signature = top.map((t) => t.listingId).join(",")

  const last = await prisma.recommendationBatch.findFirst({
    where: { buyerProfileId },
    orderBy: { createdAt: "desc" },
    include: { recommendations: { orderBy: { score: "desc" }, select: { listingId: true } } },
  })
  if (last) {
    const lastSig = last.recommendations.map((r) => r.listingId).join(",")
    if (lastSig === signature) return // unchanged — don't spam history
  }

  await saveRecommendationBatch({
    buyerProfileId,
    matches: top.map((t) => ({
      listingId: t.listingId,
      score: t.score,
      rationale: t.rationale,
    })),
  })
}

interface RankBoost {
  movedUp: number
  reason: string
}

interface LearningSummary {
  active: boolean
  evidenceCount: number
  summary: string
  shifts: Array<{ dimension: string; direction: "up" | "down"; delta: number }>
}

/** Human sentence describing that ranking used learned weights. */
function buildLearningSummary(evidenceCount: number): string {
  const showings = evidenceCount === 1 ? "1 showing" : `${evidenceCount} showings`
  return `Ranked using what we've learned from your ${showings}.`
}

/** Top 3 weight shifts (by magnitude) vs the intake prior. */
function buildShifts(
  prefState: PreferenceState
): Array<{ dimension: string; direction: "up" | "down"; delta: number }> {
  return getSignificantChanges(prefState)
    .slice(0, 3)
    .map((c) => ({
      dimension: c.dimension,
      direction: c.direction === "increased" ? ("up" as const) : ("down" as const),
      delta: Math.round(Math.abs(c.delta) * 1000) / 1000,
    }))
}

/**
 * Map internal dimension labels (from the intake ranking) to friendly,
 * buyer-facing phrases that read naturally inside a sentence. Unmapped
 * dimensions gracefully fall back to their lowercased label.
 */
const DIMENSION_PHRASES: Record<string, string> = {
  "Location & commute": "the location and commute",
  "Space & square footage": "the extra space",
  "Schools & family-friendliness": "great schools",
  "Outdoor space & yard": "outdoor space",
  "Kitchen & entertaining": "the kitchen",
  "Natural light & views": "natural light",
  "Finishes & move-in ready": "move-in-ready finishes",
  "Privacy & quiet": "peace and quiet",
}

/** Friendly buyer-facing phrase for a dimension label (graceful fallback). */
function phraseForDimension(dimension: string): string {
  return DIMENSION_PHRASES[dimension] ?? dimension.toLowerCase()
}

/**
 * Build a plain-language reason a listing climbed: name the rising dimension(s)
 * the listing actually scores well on. Falls back to the strongest rising
 * dimension if none align, then null if the buyer has no rising dimensions.
 */
function buildRankBoostReason(
  match: MatchResult,
  risingDimensions: ReturnType<typeof getSignificantChanges>
): string | null {
  if (risingDimensions.length === 0) return null

  // Prefer dimensions that both rose in weight AND score well on this listing.
  const strongOnListing = risingDimensions.filter((d) => {
    const ds = match.dimensionScores.find((s) => s.dimension === d.dimension)
    return ds && ds.score >= 65
  })

  const drivers = (strongOnListing.length > 0 ? strongOnListing : risingDimensions).slice(0, 2)
  const phrases = drivers.map((d) => phraseForDimension(d.dimension))

  if (phrases.length === 0) return null
  const list = phrases.length === 1 ? phrases[0] : `${phrases[0]} and ${phrases[1]}`
  return `Moved up because you keep responding to ${list}.`
}

/**
 * Fetch listings from DB with configurable budget multiplier and optional city filter.
 */
async function fetchListings(
  portrait: ReturnType<typeof generatePortrait>,
  budgetMultiplier: number,
  applyCityFilter: boolean
) {
  return prisma.listing.findMany({
    where: {
      status: 'ACTIVE',
      listPrice: { lte: Math.round(portrait.budget.stretch * budgetMultiplier) },
      ...(applyCityFilter && portrait.hardFilters.targetCities.length > 0 ? {
        city: { in: portrait.hardFilters.targetCities, mode: 'insensitive' as any }
      } : {}),
      bedrooms: { gte: portrait.hardFilters.minBedrooms },
    },
    take: 500,
    orderBy: { listPrice: 'desc' },
  })
}

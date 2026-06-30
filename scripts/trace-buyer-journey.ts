/**
 * READ-ONLY functional trace of the buyer journey end-to-end, against the real
 * DB, for buyer1@homematch.dev (completed intake, no feedback yet). Writes
 * NOTHING — it simulates feedback in-memory to show how the loop behaves.
 *
 *   npx tsx scripts/trace-buyer-journey.ts
 */
import { prisma } from "@/lib/prisma"
import { generatePortrait } from "@/lib/portrait/generate-portrait"
import { matchListings, matchListingsEvolved, type ListingForMatch } from "@/lib/scoring/match-engine"
import { getSchoolRatingNumber } from "@/lib/geo/school-ratings"
import {
  initializeFromIntake,
  updateWeights,
  extractSignalsFromFeedback,
  getSignificantChanges,
  type FeedbackSignal,
} from "@/lib/scoring/bayesian-learner"

function line(s = "") { console.log(s) }
function h(s: string) { line(); line("━━━ " + s + " ━━━") }

async function loadListings(portrait: ReturnType<typeof generatePortrait>): Promise<ListingForMatch[]> {
  const db = await prisma.listing.findMany({
    where: {
      status: "ACTIVE",
      listPrice: { lte: Math.round(portrait.budget.stretch * 1.15) },
      ...(portrait.hardFilters.targetCities.length
        ? { city: { in: portrait.hardFilters.targetCities, mode: "insensitive" as any } }
        : {}),
      bedrooms: { gte: portrait.hardFilters.minBedrooms },
    },
    take: 500,
    orderBy: { listPrice: "desc" },
  })
  return db.map((l) => {
    const v = (l.vector as any) || {}
    return {
      id: l.id, address: l.address, city: l.city, price: l.listPrice,
      bedrooms: l.bedrooms, bathrooms: l.bathroomsFull + l.bathroomsHalf * 0.5,
      sqft: l.interiorSqft || 0, yearBuilt: l.yearBuilt || 0, propertyType: l.propertyType,
      dimensions: {
        natural_light: v.natural_light || undefined, noise_level: v.noise_level || undefined,
        openness: v.openness || undefined, school_rating: v.school_rating || getSchoolRatingNumber(l.city),
        walk_score: v.walk_score || undefined, yard_usability: v.yard_usability || undefined,
        move_in_readiness: v.move_in_readiness || undefined,
        privacy: v.privacy_from_neighbors || v.privacy || undefined,
        kitchen_quality: v.kitchen_quality || undefined,
        commute_primary: v.commute_minutes_primary || undefined,
        style: v.style || undefined,
      },
      imageUrl: l.photos?.[0], description: l.agentNotes || undefined,
    } as ListingForMatch & { photos?: string[] }
  })
}

async function main() {
  const profile = await prisma.buyerProfile.findFirst({
    where: { user: { email: "buyer1@homematch.dev" } },
    include: { intakeResponse: true, user: true },
  })
  if (!profile?.intakeResponse?.answers) { console.log("no buyer1 intake"); return }
  const answers = profile.intakeResponse.answers as Record<string, any>

  h("STEP 1 — PORTRAIT (what the buyer sees after intake)")
  const portrait = generatePortrait(answers)
  line(`Archetype: ${portrait.archetype?.type}`)
  line(`Budget: comfortable $${portrait.budget.comfortable?.toLocaleString()} (stretch $${portrait.budget.stretch?.toLocaleString()})`)
  line(`Target cities: ${portrait.hardFilters.targetCities.join(", ") || "(none)"} | min beds ${portrait.hardFilters.minBedrooms}`)
  line(`Priorities (stated): ${portrait.priorities.map((p: any) => `${p.item}(${(p.weight*100).toFixed(0)}%)`).join(", ")}`)
  line(`Decision points: ${(portrait.blindSpots || []).length} | prose paras: ${(portrait.prose||[]).length}`)

  h("STEP 2 — FIRST RECOMMENDATIONS (cold start, stated weights)")
  const listings = await loadListings(portrait)
  line(`Listings in budget/area/beds: ${listings.length}`)
  const first = matchListings(portrait, listings)
  line(`Matched (passed hard filters): ${first.length}`)
  line("Top 5:")
  first.slice(0, 5).forEach((m, i) =>
    line(`  ${i + 1}. ${m.score}% ${m.verdict.padEnd(6)} ${m.listing.address}, ${m.listing.city} $${m.listing.price.toLocaleString()} | ${m.reasons?.[0] ?? ""}`)
  )
  if (first[0]) {
    line(`  Per-dimension breakdown (top match): ` +
      first[0].dimensionScores.map((d: any) => `${d.label}:${d.score}`).join(" "))
  }

  h("STEP 3 — SIMULATE SHOWING FEEDBACK (buyer loves a bright home, dislikes a small kitchen)")
  // Pick a real shown listing to attach feedback to
  const shown = first[0]
  const liked = "bright, sunny, quiet"
  const disliked = "small kitchen, dark"
  const signals = extractSignalsFromFeedback({
    liked, disliked, verdict: "love",
    listingDimensions: shown ? Object.fromEntries(shown.dimensionScores.map((d: any) => [d.dimension, d.score])) : {},
  })
  line(`liked="${liked}" disliked="${disliked}" verdict=love`)
  line(`→ extracted dimension signals: ${JSON.stringify(signals)}`)

  h("STEP 4 — LEARNING (weights evolve from the feedback)")
  let state = initializeFromIntake(portrait.priorities.map((p: any, i: number) => ({ item: p.item, rank: i + 1, weight: p.weight })))
  // apply several feedback rounds (love bright/quiet, dislike small kitchen) to show drift
  for (let r = 0; r < 3; r++) {
    const sig: FeedbackSignal = { source: "FEEDBACK_CHIPS", dimensionSignals: signals, listingId: shown?.listing.id || "x", listingDimensions: {}, timestamp: new Date(0).toISOString() }
    state = updateWeights(state, sig).newState
  }
  line(`evidenceCount after 3 feedback rounds: ${state.evidenceCount}`)
  const changes = getSignificantChanges(state)
  if (changes.length === 0) line("⚠️ NO significant weight changes detected")
  changes.forEach((c: any) =>
    line(`  ${c.direction === "increased" ? "↑" : "↓"} ${c.dimension}: ${(c.priorWeight*100).toFixed(0)}% → ${(c.currentWeight*100).toFixed(0)}% (${c.direction})`))

  h("STEP 5 — RE-RANKED RECOMMENDATIONS (evolved weights) vs FIRST")
  const evolved = matchListingsEvolved(portrait, listings, state)
  const firstPos = new Map(first.map((m, i) => [m.listing.id, i]))
  line("Top 5 after learning (Δ = positions moved vs first ranking):")
  evolved.slice(0, 5).forEach((m, i) => {
    const prev = firstPos.get(m.listing.id)
    const delta = prev === undefined ? "new" : (prev - i > 0 ? `↑${prev - i}` : prev - i < 0 ? `↓${i - prev}` : "=")
    line(`  ${i + 1}. ${m.score}% ${m.listing.address}, ${m.listing.city}  [${delta}]`)
  })
  const moved = evolved.slice(0, 10).filter((m, i) => { const p = firstPos.get(m.listing.id); return p !== undefined && p !== i }).length
  line(`\nVERDICT: ${moved > 0 ? `✓ learning re-ranked the list (${moved} of top 10 moved)` : "⚠️ ranking UNCHANGED after feedback — loop not visibly working"}`)
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error("TRACE ERROR:", e.message); prisma.$disconnect(); process.exit(1) })

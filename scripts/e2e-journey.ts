/**
 * FULL customer-journey e2e trace with AI ON (via whatever credential is in env).
 * Read-mostly: the two write steps (feedback → _preferenceState, recommendation
 * batch) are performed then CLEANED UP so the buyer's real data is unchanged.
 *
 *   AWS_BEARER_TOKEN_BEDROCK=... AWS_REGION=us-west-2 npx tsx scripts/e2e-journey.ts
 */
import { prisma } from "@/lib/prisma"
import { generatePortrait } from "@/lib/portrait/generate-portrait"
import { generateAINarrative } from "@/lib/portrait/ai-portrait"
import { generateWhyThisHome } from "@/lib/portrait/why-this-home"
import { matchListings, matchListingsEvolved, type ListingForMatch } from "@/lib/scoring/match-engine"
import { getSchoolRatingNumber } from "@/lib/geo/school-ratings"
import { initializeFromIntake, updateWeights, extractSignalsFromFeedback, getSignificantChanges, type FeedbackSignal } from "@/lib/scoring/bayesian-learner"
import { normalizeTargetCities } from "@/lib/data/ma-towns"
import { saveRecommendationBatch, listRecommendationBatches } from "@/lib/recommendations/persist"

const h = (s: string) => console.log("\n" + "━".repeat(70) + "\n  " + s + "\n" + "━".repeat(70))

async function loadListings(portrait: any): Promise<ListingForMatch[]> {
  portrait.hardFilters.targetCities = normalizeTargetCities(portrait.hardFilters.targetCities)
  const useCity = portrait.hardFilters.targetCities.length > 0
  const db = await prisma.listing.findMany({
    where: { status: "ACTIVE", listPrice: { lte: Math.round(portrait.budget.stretch * 1.3) }, bedrooms: { gte: portrait.hardFilters.minBedrooms }, ...(useCity ? { city: { in: portrait.hardFilters.targetCities, mode: "insensitive" as any } } : {}) },
    take: 300, orderBy: { listPrice: "desc" },
  })
  return db.map((l) => {
    const v = (l.vector as any) || {}
    return { id: l.id, address: l.address, city: l.city, price: l.listPrice, bedrooms: l.bedrooms, bathrooms: l.bathroomsFull + l.bathroomsHalf * 0.5, sqft: l.interiorSqft || 0, yearBuilt: l.yearBuilt || 0, propertyType: l.propertyType,
      dimensions: { natural_light: v.natural_light || undefined, noise_level: v.noise_level || undefined, openness: v.openness || undefined, school_rating: v.school_rating || getSchoolRatingNumber(l.city), yard_usability: v.yard_usability || undefined, move_in_readiness: v.move_in_readiness || undefined, privacy: v.privacy_from_neighbors || undefined, kitchen_quality: v.kitchen_quality || undefined, style: v.style || undefined },
      imageUrl: l.photos?.[0], description: l.agentNotes || undefined } as ListingForMatch
  })
}

async function main() {
  const provider = process.env.AWS_BEARER_TOKEN_BEDROCK || process.env.AWS_ACCESS_KEY_ID ? "Bedrock" : process.env.ANTHROPIC_API_KEY ? "Anthropic" : "NONE (deterministic only)"
  console.log("AI provider in use:", provider)

  const profile = await prisma.buyerProfile.findFirst({ where: { user: { email: "buyer1@homematch.dev" } }, include: { intakeResponse: true, user: true } })
  const answers = profile!.intakeResponse!.answers as Record<string, any>

  h("STAGE 1 — INTAKE → PORTRAIT (deterministic)")
  const portrait = generatePortrait(answers)
  console.log("Buyer:", profile!.user.email, "| archetype:", portrait.archetype?.type)
  console.log("Budget stretch: $" + portrait.budget.stretch?.toLocaleString(), "| min beds:", portrait.hardFilters.minBedrooms)
  console.log("Stated priorities:", portrait.priorities.slice(0, 4).map((p: any) => `${p.item} ${(p.weight * 100).toFixed(0)}%`).join(", "))

  h("STAGE 2 — AI PORTRAIT NARRATIVE (Claude)")
  const narrative = await generateAINarrative(answers, "en")
  if (narrative) { console.log("✓ AI narrative generated. First paragraph:\n"); console.log("  " + (narrative.prose[0] || "").slice(0, 320)) }
  else console.log("(null → deterministic fallback: no AI credential or call failed)")

  h("STAGE 3 — FIRST RECOMMENDATIONS (cold start, stated weights)")
  const listings = await loadListings(portrait)
  const first = matchListings(portrait, listings)
  console.log(`Considered ${listings.length} listings → ${first.length} matched. Top 3:`)
  first.slice(0, 3).forEach((m, i) => console.log(`  ${i + 1}. ${m.score}% ${m.verdict} — ${m.listing.address}, ${m.listing.city} $${m.listing.price.toLocaleString()}`))

  h("STAGE 4 — AI 'WHY THIS HOME' for the #1 match (Claude, grounded)")
  const top = first[0]
  const why = await generateWhyThisHome({
    listing: { address: top.listing.address, city: top.listing.city, price: top.listing.price, bedrooms: top.listing.bedrooms, bathrooms: top.listing.bathrooms, sqft: top.listing.sqft, propertyType: top.listing.propertyType, description: top.listing.description, keyReasons: top.reasons, concerns: top.concerns, dimensionScores: top.dimensionScores },
    buyer: { archetype: portrait.archetype?.type, threeWords: answers.open_text?.threeWords, painPoints: answers.pain_points, openText: answers.open_text?.anythingElse, priorities: portrait.priorities.map((p: any) => ({ item: p.item, weight: p.weight })) },
    locale: "en",
  })
  console.log(why ? "✓ " + why.paragraph : "(null → deterministic reasons shown instead)")

  h("STAGE 5 — FEEDBACK → LEARNING (buyer loves bright/quiet, dislikes small kitchen)")
  let state = initializeFromIntake(portrait.priorities.map((p: any, i: number) => ({ item: p.item, rank: i + 1, weight: p.weight })))
  const signals = extractSignalsFromFeedback({ liked: "bright, sunny, quiet, private", disliked: "small kitchen, dark", verdict: "love", listingDimensions: {} })
  for (let i = 0; i < 3; i++) state = updateWeights(state, { source: "FEEDBACK_CHIPS", dimensionSignals: signals, listingId: top.listing.id, listingDimensions: {}, timestamp: new Date(0).toISOString() } as FeedbackSignal).newState
  console.log("Evolved weight shifts after 3 feedbacks:")
  getSignificantChanges(state).forEach((c: any) => console.log(`  ${c.direction === "increased" ? "↑" : "↓"} ${c.dimension}: ${(c.priorWeight * 100).toFixed(0)}% → ${(c.currentWeight * 100).toFixed(0)}%`))

  h("STAGE 6 — RE-RANK with learned weights")
  const evolved = matchListingsEvolved(portrait, listings, state)
  const firstPos = new Map(first.map((m, i) => [m.listing.id, i]))
  let moved = 0
  evolved.slice(0, 5).forEach((m, i) => { const p = firstPos.get(m.listing.id); const d = p === undefined ? "new" : p - i > 0 ? `↑${p - i}` : p - i < 0 ? `↓${i - p}` : "="; if (p !== undefined && p !== i) moved++; console.log(`  ${i + 1}. ${m.score}% ${m.listing.address} [${d}]`) })
  console.log(moved > 0 ? `\n✓ Learning re-ranked the list (${moved}/5 top moved)` : "\n(ranking stable)")

  h("STAGE 7 — PERSIST RECOMMENDATION BATCH → journey timeline")
  const batchId = await saveRecommendationBatch({ buyerProfileId: profile!.id, matches: evolved.slice(0, 5).map((m) => ({ listingId: m.listing.id, score: m.score, rationale: { verdict: m.verdict, reasons: m.reasons, concerns: m.concerns, dimensionScores: m.dimensionScores } })) })
  const batches = await listRecommendationBatches(profile!.id)
  console.log(`✓ Saved batch ${batchId}. Buyer now has ${batches.length} batch(es) in timeline; newest has ${batches[0].recommendations.length} homes.`)
  // CLEANUP test writes
  await prisma.recommendation.deleteMany({ where: { batchId } })
  await prisma.recommendationBatch.delete({ where: { id: batchId } })
  console.log("✓ cleaned up test batch (buyer data unchanged)")

  h("E2E COMPLETE")
  console.log("intake → portrait → AI narrative → matches → AI why-this-home → feedback → learning → re-rank → timeline")
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error("E2E ERROR:", e.message); prisma.$disconnect(); process.exit(1) })

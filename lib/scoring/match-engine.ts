/**
 * Match Engine: Scores listings against a buyer portrait.
 * 
 * Two-stage approach:
 * 1. Hard filter: Eliminate listings that violate dealbreakers (wrong city, over budget, too few BR)
 * 2. Soft scoring: Weighted multi-dimensional match based on buyer priorities
 * 
 * v2: Now supports evolved weights from Bayesian preference learning.
 * If a PreferenceState is provided, uses the evolved weights (from showing feedback)
 * instead of the static intake weights.
 */

import type { BuyerPortrait } from "@/lib/portrait/generate-portrait"
import type { PreferenceState } from "./bayesian-learner"
import type { StyleClassification, BuyerStylePreferences, ArchitecturalStyle, EraFeel } from "@/lib/vision/style-tags"
import { STYLE_CATEGORIES } from "@/lib/vision/style-tags"
import { computeStyleMatchScore } from "@/lib/vision/style-matcher"

/**
 * Buyer intake stores architectural style picks as the VisualStylePicker ids
 * (see lib/data/style-examples.ts), e.g. "cape", "bungalow", "cottage".
 * The AI vision taxonomy (lib/vision/style-tags.ts) uses different keys, e.g.
 * "cape_cod", "craftsman", "farmhouse". Without normalization the buyer's
 * style prefs never overlap the listing's classified tags, so style scoring
 * silently no-ops. This map bridges intake ids → taxonomy ArchitecturalStyle.
 */
const STYLE_ID_TO_ARCHITECTURAL: Record<string, ArchitecturalStyle> = {
  colonial: "colonial",
  cape: "cape_cod",
  cape_cod: "cape_cod",
  contemporary: "contemporary",
  modern: "contemporary",
  victorian: "victorian",
  ranch: "ranch",
  tudor: "tudor",
  bungalow: "craftsman",
  craftsman: "craftsman",
  cottage: "farmhouse",
  farmhouse: "farmhouse",
}

const ARCHITECTURAL_SET = new Set<string>(STYLE_CATEGORIES.architectural)
const ERA_SET = new Set<string>(STYLE_CATEGORIES.era)

/**
 * Normalize a buyer's stated style picks (intake ids or free strings) into the
 * taxonomy's ArchitecturalStyle values so they can match listing style_tags.
 */
function normalizeBuyerArchitecturalStyles(styles: string[]): ArchitecturalStyle[] {
  const normalized = new Set<ArchitecturalStyle>()
  for (const raw of styles) {
    const key = raw.toLowerCase().trim().replace(/\s+/g, "_")
    const mapped = STYLE_ID_TO_ARCHITECTURAL[key]
    if (mapped) {
      normalized.add(mapped)
    } else if (ARCHITECTURAL_SET.has(key)) {
      normalized.add(key as ArchitecturalStyle)
    }
  }
  return [...normalized]
}

export interface ListingForMatch {
  id: string
  address: string
  city: string
  price: number
  bedrooms: number
  bathrooms: number
  sqft: number
  yearBuilt: number
  propertyType: string
  // Agent-scored dimensions (1-5 or enum)
  dimensions: {
    natural_light?: number       // 1-5
    noise_level?: number         // 1-5 (5 = very quiet)
    openness?: number            // 1-5
    school_rating?: number       // 1-10
    walk_score?: number          // 0-100
    yard_usability?: number      // 1-5
    move_in_readiness?: number   // 1-5
    privacy?: number             // 1-5
    kitchen_quality?: number     // 1-5
    commute_primary?: number     // minutes
    commute_secondary?: number   // minutes
    style?: string               // Colonial, Cape Cod, etc.
    street_type?: string         // quiet_residential, busy, etc.
    style_tags?: StyleClassification  // AI-classified visual style tags
  }
  // Display
  imageUrl?: string
  description?: string
}

export interface DimensionScore {
  dimension: string
  label: string
  score: number    // 0-100
  weight: number   // buyer's priority weight for this dimension
  assessed: boolean // false when the listing has no data for this dimension (cold-start)
}

export interface MatchResult {
  listing: ListingForMatch
  score: number              // 0-100
  verdict: "strong" | "good" | "fair" | "weak"
  reasons: string[]          // Why this matches
  concerns: string[]         // What doesn't quite fit
  highlights: string[]       // Top 3 selling points for this buyer
  dimensionScores: DimensionScore[]  // Per-dimension breakdown
}

/**
 * Score all listings against a buyer portrait using EVOLVED weights.
 * Falls back to static intake weights if no preference state is provided.
 * Returns sorted results (best first).
 */
export function matchListingsEvolved(
  portrait: BuyerPortrait,
  listings: ListingForMatch[],
  preferenceState: PreferenceState
): MatchResult[] {
  // Override portrait priorities with evolved weights
  const evolvedPortrait = {
    ...portrait,
    priorities: preferenceState.current.map((dw, idx) => ({
      item: dw.dimension,
      rank: idx + 1,
      weight: dw.weight,
    })),
  }
  return matchListings(evolvedPortrait, listings)
}

/**
 * Score all listings against a buyer portrait.
 * Returns sorted results (best first).
 */
export function matchListings(
  portrait: BuyerPortrait,
  listings: ListingForMatch[]
): MatchResult[] {
  const results: MatchResult[] = []

  for (const listing of listings) {
    // Stage 1: Hard filters
    const filterResult = applyHardFilters(portrait, listing)
    if (filterResult.eliminated) continue

    // Stage 2: Soft scoring
    const { score, reasons, concerns, highlights, dimensionScores } = scoreListing(portrait, listing)

    const verdict: MatchResult["verdict"] =
      score >= 80 ? "strong" :
      score >= 65 ? "good" :
      score >= 50 ? "fair" : "weak"

    results.push({ listing, score, verdict, reasons, concerns, highlights, dimensionScores })
  }

  // Sort by score descending
  return results.sort((a, b) => b.score - a.score)
}

// --- Hard Filter ---
function applyHardFilters(
  portrait: BuyerPortrait,
  listing: ListingForMatch
): { eliminated: boolean; reason?: string } {
  // Over budget (with flexibility)
  const maxBudget = portrait.budget.stretch * 1.15 // Allow some flex
  if (listing.price > maxBudget) {
    return { eliminated: true, reason: "Over budget" }
  }

  // Wrong city
  if (portrait.hardFilters.targetCities.length > 0) {
    const cityMatch = portrait.hardFilters.targetCities.some(
      (c) => listing.city.toLowerCase().includes(c.toLowerCase())
    )
    if (!cityMatch) return { eliminated: true, reason: "Wrong area" }
  }

  // Too few bedrooms
  if (listing.bedrooms < portrait.hardFilters.minBedrooms) {
    return { eliminated: true, reason: "Too few bedrooms" }
  }

  // Too few bathrooms
  if (listing.bathrooms < portrait.hardFilters.minBathrooms) {
    return { eliminated: true, reason: "Too few bathrooms" }
  }

  return { eliminated: false }
}

const DIMENSION_SHORT_LABELS: Record<string, string> = {
  "Schools & family-friendliness": "Schools",
  "Privacy & quiet": "Quiet",
  "Natural light & views": "Light",
  "Location & commute": "Commute",
  "Outdoor space & yard": "Yard",
  "Space & square footage": "Space",
  "Kitchen & entertaining": "Kitchen",
  "Finishes & move-in ready": "Condition",
}

// A dimension's scorer reports both the 0-100 score AND whether the listing
// actually had data to assess it. Cold-start honesty: when `assessed` is false,
// we must NOT credit (or fabricate) reasons/concerns and must NOT fold a guessed
// midpoint into the weighted score — instead we surface "not yet assessed".
type DimScoreResult = { score: number; assessed: boolean }

// Helper: present() treats null/undefined as missing (a real 0 stays present).
const present = (v: number | undefined | null): v is number => v !== undefined && v !== null

// --- Soft Scoring ---
function scoreListing(
  portrait: BuyerPortrait,
  listing: ListingForMatch
): { score: number; reasons: string[]; concerns: string[]; highlights: string[]; dimensionScores: DimensionScore[] } {
  const reasons: string[] = []
  const concerns: string[] = []
  const highlights: string[] = []
  let totalScore = 0
  let totalWeight = 0
  const d = listing.dimensions

  // Map priorities to scoring functions. Each returns { score, assessed }; a
  // dimension is only "assessed" when the listing actually carries its data, so
  // we never bluff a confident score (or positive reason) from a defaulted
  // midpoint.
  const priorityScorers: Record<string, () => DimScoreResult> = {
    "Schools & family-friendliness": () => {
      if (!present(d.school_rating)) return { score: 0, assessed: false }
      const rating = d.school_rating
      const score = Math.min(rating / 10, 1) * 100
      if (rating >= 8) reasons.push(`Top school district (${rating}/10)`)
      else if (rating <= 5) concerns.push(`School rating only ${rating}/10`)
      return { score, assessed: true }
    },
    "Privacy & quiet": () => {
      // Assessable if we know at least one of noise/privacy. Missing legs default
      // to a neutral midpoint only to combine with the known leg — but if BOTH
      // are missing we report unassessed.
      if (!present(d.noise_level) && !present(d.privacy)) return { score: 0, assessed: false }
      const quiet = present(d.noise_level) ? d.noise_level : 3
      const privacy = present(d.privacy) ? d.privacy : 3
      const street = d.street_type
      const score = ((quiet + privacy) / 10) * 100
      if (present(d.noise_level) && quiet >= 4 && street === "quiet_residential") reasons.push("Quiet residential street")
      if (present(d.noise_level) && quiet <= 2) concerns.push("Noise concerns — close to busy road")
      return { score, assessed: true }
    },
    "Natural light & views": () => {
      if (!present(d.natural_light)) return { score: 0, assessed: false }
      const light = d.natural_light
      const score = (light / 5) * 100
      if (light >= 4) reasons.push(`Excellent natural light (${light}/5)`)
      if (light <= 2) concerns.push("Limited natural light")
      return { score, assessed: true }
    },
    "Location & commute": () => {
      if (!present(d.commute_primary) && !present(d.commute_secondary)) return { score: 0, assessed: false }
      const primary = present(d.commute_primary) ? d.commute_primary : 40
      const secondary = present(d.commute_secondary) ? d.commute_secondary : 40
      const avg = (primary + secondary) / 2
      const score = Math.max(0, 100 - (avg - 15) * 3) // 15min = 100, 45min = 10
      if (avg <= 25) reasons.push(`Short commute (avg ${Math.round(avg)} min)`)
      if (avg >= 40) concerns.push(`Long commute (avg ${Math.round(avg)} min)`)
      return { score: Math.max(0, Math.min(100, score)), assessed: true }
    },
    "Outdoor space & yard": () => {
      if (!present(d.yard_usability)) return { score: 0, assessed: false }
      const yard = d.yard_usability
      const score = (yard / 5) * 100
      if (yard >= 4) reasons.push("Great yard space")
      if (yard <= 2) concerns.push("Limited outdoor space")
      return { score, assessed: true }
    },
    "Space & square footage": () => {
      // Always assessable — derived from sqft, which every listing carries.
      const target = portrait.hardFilters.minBedrooms * 450 + 600
      const ratio = listing.sqft / target
      const score = Math.min(ratio, 1.2) * 83 // Cap at 100
      if (listing.sqft >= target) reasons.push(`Spacious at ${listing.sqft.toLocaleString()} sqft`)
      if (listing.sqft < target * 0.75) concerns.push(`Only ${listing.sqft.toLocaleString()} sqft`)
      return { score: Math.min(100, score), assessed: true }
    },
    "Kitchen & entertaining": () => {
      if (!present(d.kitchen_quality) && !present(d.openness)) return { score: 0, assessed: false }
      const kitchen = present(d.kitchen_quality) ? d.kitchen_quality : 3
      const openness = present(d.openness) ? d.openness : 3
      const score = ((kitchen + openness) / 10) * 100
      if (present(d.kitchen_quality) && present(d.openness) && kitchen >= 4 && openness >= 4) reasons.push("Updated kitchen with open layout")
      if (present(d.kitchen_quality) && kitchen <= 2) concerns.push("Kitchen needs renovation")
      return { score, assessed: true }
    },
    "Finishes & move-in ready": () => {
      if (!present(d.move_in_readiness)) return { score: 0, assessed: false }
      const readiness = d.move_in_readiness
      const score = (readiness / 5) * 100
      if (readiness >= 4) reasons.push("Move-in ready condition")
      if (readiness <= 2) concerns.push("Needs significant updates")
      return { score, assessed: true }
    },
  }

  // Score each priority with its weight. Only ASSESSED dimensions contribute to
  // the weighted average — we renormalize over the assessed weight so a listing
  // with sparse data isn't propped up by guessed midpoints. Unassessed
  // dimensions are still listed (so the buyer sees what we couldn't evaluate)
  // but flagged assessed:false and excluded from the aggregate.
  const dimensionScores: DimensionScore[] = []
  for (const priority of portrait.priorities) {
    const scorer = priorityScorers[priority.item]
    if (scorer) {
      const { score: dimScore, assessed } = scorer()
      if (assessed) {
        totalScore += dimScore * priority.weight
        totalWeight += priority.weight
      }
      dimensionScores.push({
        dimension: priority.item,
        label: DIMENSION_SHORT_LABELS[priority.item] || priority.item,
        score: assessed ? Math.round(dimScore) : 0,
        weight: priority.weight,
        assessed,
      })
    }
  }

  // Bonus: AI vision style match (uses structured style tags when available)
  if (listing.dimensions.style_tags && portrait.homePreferences?.styles.length > 0) {
    // Convert portrait styles into BuyerStylePreferences format.
    // Buyer picks are intake ids (e.g. "cape", "bungalow") — normalize them to
    // the taxonomy so they actually overlap the listing's classified tags.
    const architectural_style = normalizeBuyerArchitecturalStyles(portrait.homePreferences.styles)
    const eraKey = portrait.homePreferences.era?.toLowerCase().trim().replace(/\s+/g, "_")
    const buyerStylePrefs: BuyerStylePreferences = {
      architectural_style: architectural_style.length > 0 ? architectural_style : undefined,
      era_feel: eraKey && ERA_SET.has(eraKey) ? [eraKey as EraFeel] : undefined,
    }
    const styleScore = computeStyleMatchScore(buyerStylePrefs, listing.dimensions.style_tags)
    // Convert 0-100 style score to a weighted bonus (max +8 points)
    const styleBonus = (styleScore / 100) * 8
    totalScore += styleBonus
    if (styleScore >= 70) {
      const topStyle = listing.dimensions.style_tags.architectural_style[0]?.replace(/_/g, " ")
      highlights.push(`${topStyle ? topStyle.charAt(0).toUpperCase() + topStyle.slice(1) : "Style"} — strong aesthetic match`)
    }
  } else if (portrait.homePreferences?.styles.length > 0 && listing.dimensions.style) {
    // Fallback: simple string match for listings without AI tags
    const styleMatch = portrait.homePreferences.styles.some(
      (s) => listing.dimensions.style?.toLowerCase().includes(s.toLowerCase())
    )
    if (styleMatch) {
      totalScore += 5
      highlights.push(`${listing.dimensions.style} — matches your style preference`)
    }
  }

  // Bonus: Walk score for urbanists
  if (listing.dimensions.walk_score && listing.dimensions.walk_score >= 70) {
    const walkPriority = portrait.priorities.find(p => p.item === "Location & commute")
    if (walkPriority && walkPriority.rank <= 3) {
      highlights.push(`Walk Score: ${listing.dimensions.walk_score}`)
    }
  }

  // Budget positioning
  const budgetPct = (listing.price / portrait.budget.stretch) * 100
  if (budgetPct <= 85) {
    highlights.push("Under budget — room to negotiate or renovate")
  } else if (budgetPct > 100) {
    concerns.push(`${Math.round(budgetPct - 100)}% above your comfortable range`)
  }

  // Normalize score over the ASSESSED weight only. If nothing could be assessed
  // (no listing data for any weighted dimension), don't fabricate a confident
  // ~50% "coin flip" — report a low, clearly-unconfident score so the verdict
  // lands as "weak"/"Stretch" rather than implying a real evaluation happened.
  const finalScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0

  // Pick top 3 highlights. reasons[] now only contain claims for dimensions the
  // listing actually had data for, so highlights stay honest.
  const topHighlights = [...reasons.slice(0, 2), ...highlights.slice(0, 1)].slice(0, 3)

  return {
    score: Math.min(100, Math.max(0, finalScore)),
    reasons,
    concerns,
    highlights: topHighlights,
    dimensionScores: dimensionScores.sort((a, b) => b.weight - a.weight),
  }
}

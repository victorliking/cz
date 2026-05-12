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

  // Map priorities to scoring functions
  const priorityScorers: Record<string, () => number> = {
    "Schools & family-friendliness": () => {
      const rating = listing.dimensions.school_rating || 5
      const score = Math.min(rating / 10, 1) * 100
      if (rating >= 8) reasons.push(`Top school district (${rating}/10)`)
      else if (rating <= 5) concerns.push(`School rating only ${rating}/10`)
      return score
    },
    "Privacy & quiet": () => {
      const quiet = listing.dimensions.noise_level || 3
      const privacy = listing.dimensions.privacy || 3
      const street = listing.dimensions.street_type
      const score = ((quiet + privacy) / 10) * 100
      if (quiet >= 4 && street === "quiet_residential") reasons.push("Quiet residential street")
      if (quiet <= 2) concerns.push("Noise concerns — close to busy road")
      return score
    },
    "Natural light & views": () => {
      const light = listing.dimensions.natural_light || 3
      const score = (light / 5) * 100
      if (light >= 4) reasons.push(`Excellent natural light (${light}/5)`)
      if (light <= 2) concerns.push("Limited natural light")
      return score
    },
    "Location & commute": () => {
      const primary = listing.dimensions.commute_primary || 40
      const secondary = listing.dimensions.commute_secondary || 40
      const avg = (primary + secondary) / 2
      const score = Math.max(0, 100 - (avg - 15) * 3) // 15min = 100, 45min = 10
      if (avg <= 25) reasons.push(`Short commute (avg ${Math.round(avg)} min)`)
      if (avg >= 40) concerns.push(`Long commute (avg ${Math.round(avg)} min)`)
      return Math.max(0, Math.min(100, score))
    },
    "Outdoor space & yard": () => {
      const yard = listing.dimensions.yard_usability || 2
      const score = (yard / 5) * 100
      if (yard >= 4) reasons.push("Great yard space")
      if (yard <= 2) concerns.push("Limited outdoor space")
      return score
    },
    "Space & square footage": () => {
      // Score based on sqft relative to expectation (~1800-2200 for family)
      const target = 2000
      const ratio = listing.sqft / target
      const score = Math.min(ratio, 1.2) * 83 // Cap at 100
      if (listing.sqft >= 2000) reasons.push(`Spacious at ${listing.sqft.toLocaleString()} sqft`)
      if (listing.sqft < 1500) concerns.push(`Only ${listing.sqft.toLocaleString()} sqft`)
      return Math.min(100, score)
    },
    "Kitchen & entertaining": () => {
      const kitchen = listing.dimensions.kitchen_quality || 3
      const openness = listing.dimensions.openness || 3
      const score = ((kitchen + openness) / 10) * 100
      if (kitchen >= 4 && openness >= 4) reasons.push("Updated kitchen with open layout")
      if (kitchen <= 2) concerns.push("Kitchen needs renovation")
      return score
    },
    "Finishes & move-in ready": () => {
      const readiness = listing.dimensions.move_in_readiness || 3
      const score = (readiness / 5) * 100
      if (readiness >= 4) reasons.push("Move-in ready condition")
      if (readiness <= 2) concerns.push("Needs significant updates")
      return score
    },
  }

  // Score each priority with its weight
  const dimensionScores: DimensionScore[] = []
  for (const priority of portrait.priorities) {
    const scorer = priorityScorers[priority.item]
    if (scorer) {
      const dimScore = scorer()
      totalScore += dimScore * priority.weight
      totalWeight += priority.weight
      dimensionScores.push({
        dimension: priority.item,
        label: DIMENSION_SHORT_LABELS[priority.item] || priority.item,
        score: Math.round(dimScore),
        weight: priority.weight,
      })
    }
  }

  // Bonus: Style match
  if (portrait.homePreferences?.styles.length > 0 && listing.dimensions.style) {
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

  // Normalize score
  const finalScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 50

  // Pick top 3 highlights
  const topHighlights = [...reasons.slice(0, 2), ...highlights.slice(0, 1)].slice(0, 3)

  return {
    score: Math.min(100, Math.max(0, finalScore)),
    reasons,
    concerns,
    highlights: topHighlights,
    dimensionScores: dimensionScores.sort((a, b) => b.weight - a.weight),
  }
}

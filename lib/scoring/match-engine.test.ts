import { describe, it, expect } from "vitest"
import {
  matchListings,
  matchListingsEvolved,
  type ListingForMatch,
  type MatchResult,
} from "@/lib/scoring/match-engine"
import type { BuyerPortrait } from "@/lib/portrait/generate-portrait"
import type { PreferenceState } from "@/lib/scoring/bayesian-learner"

/**
 * Minimal BuyerPortrait factory.
 *
 * We keep homePreferences.styles empty so the style-matching bonus path
 * (which pulls in @/lib/vision/style-matcher) never fires — these tests
 * exercise the hard filters, verdict thresholds, and weighted scoring only.
 */
function makePortrait(overrides: Partial<BuyerPortrait> = {}): BuyerPortrait {
  return {
    archetype: { type: "The Nester", headline: "" },
    prose: [],
    blindSpots: [],
    searchStrategy: "",
    budget: { comfortable: 700000, stretch: 800000, flexibility: null, cities: [] },
    hardFilters: {
      minBedrooms: 3,
      minBathrooms: 2,
      propertyTypes: ["SFH"],
      targetCities: ["Newton"],
      commuteAnchors: [],
    },
    homePreferences: { styles: [], era: null, features: [], lightPreference: null },
    timeline: null,
    priorities: [
      { item: "Natural light & views", rank: 1, weight: 0.5 },
      { item: "Space & square footage", rank: 2, weight: 0.3 },
      { item: "Privacy & quiet", rank: 3, weight: 0.2 },
    ],
    lifestyle: {
      saturdayMorning: [],
      hostingStyle: null,
      renovationAppetite: null,
      remoteWork: null,
      neighborhoodVibe: null,
    },
    household: [],
    parkingNeeds: null,
    hoaTolerance: null,
    dealbreakers: [],
    freeText: { threeWords: null, notes: null },
    insights: [],
    ...overrides,
  }
}

function makeListing(overrides: Partial<ListingForMatch> = {}): ListingForMatch {
  return {
    id: "base",
    address: "1 Main St",
    city: "Newton",
    price: 750000,
    bedrooms: 3,
    bathrooms: 2,
    sqft: 2000,
    yearBuilt: 1990,
    propertyType: "SFH",
    dimensions: {},
    ...overrides,
  }
}

describe("matchListings hard filters", () => {
  it("eliminates listings priced above stretch * 1.15", () => {
    const portrait = makePortrait() // stretch 800k -> max 920k
    const overBudget = makeListing({ id: "over", price: 950000 })
    const inBudget = makeListing({ id: "ok", price: 900000 })
    const results = matchListings(portrait, [overBudget, inBudget])
    expect(results.map((r) => r.listing.id)).toEqual(["ok"])
  })

  it("keeps a listing exactly at the budget flex ceiling (stretch * 1.15)", () => {
    const portrait = makePortrait()
    const atCeiling = makeListing({ id: "ceiling", price: 800000 * 1.15 })
    const results = matchListings(portrait, [atCeiling])
    expect(results).toHaveLength(1)
  })

  it("eliminates listings in the wrong city", () => {
    const portrait = makePortrait({
      hardFilters: { ...makePortrait().hardFilters, targetCities: ["Newton"] },
    })
    const wrongCity = makeListing({ id: "wrong", city: "Worcester" })
    const rightCity = makeListing({ id: "right", city: "Newton" })
    const results = matchListings(portrait, [wrongCity, rightCity])
    expect(results.map((r) => r.listing.id)).toEqual(["right"])
  })

  it("does a case-insensitive substring match on city", () => {
    const portrait = makePortrait({
      hardFilters: { ...makePortrait().hardFilters, targetCities: ["newton"] },
    })
    const results = matchListings(portrait, [makeListing({ city: "West Newton" })])
    expect(results).toHaveLength(1)
  })

  it("eliminates listings with too few bedrooms", () => {
    const portrait = makePortrait() // minBedrooms 3
    const tooFew = makeListing({ id: "small", bedrooms: 2 })
    const enough = makeListing({ id: "ok", bedrooms: 3 })
    const results = matchListings(portrait, [tooFew, enough])
    expect(results.map((r) => r.listing.id)).toEqual(["ok"])
  })

  it("eliminates listings with too few bathrooms", () => {
    const portrait = makePortrait() // minBathrooms 2
    const tooFew = makeListing({ id: "small", bathrooms: 1 })
    const enough = makeListing({ id: "ok", bathrooms: 2 })
    const results = matchListings(portrait, [tooFew, enough])
    expect(results.map((r) => r.listing.id)).toEqual(["ok"])
  })

  it("does not filter on city when no target cities are specified", () => {
    const portrait = makePortrait({
      hardFilters: { ...makePortrait().hardFilters, targetCities: [] },
    })
    const results = matchListings(portrait, [makeListing({ city: "Anywhere" })])
    expect(results).toHaveLength(1)
  })
})

describe("matchListings verdict thresholds", () => {
  // verdict = strong >=80, good >=65, fair >=50, weak otherwise
  function verdictFor(score: number): MatchResult["verdict"] {
    return score >= 80 ? "strong" : score >= 65 ? "good" : score >= 50 ? "fair" : "weak"
  }

  it("labels a listing strong in all weighted dimensions as 'strong'", () => {
    const portrait = makePortrait()
    const great = makeListing({
      dimensions: {
        natural_light: 5,   // 100
        privacy: 5,
        noise_level: 5,     // (5+5)/10*100 = 100
        // Space scored from sqft vs target (minBed 3 -> target 1950); 2000 -> just over -> high
      },
      sqft: 2400,
    })
    const [result] = matchListings(portrait, [great])
    expect(result.score).toBeGreaterThanOrEqual(80)
    expect(result.verdict).toBe("strong")
    expect(verdictFor(result.score)).toBe(result.verdict)
  })

  it("labels a listing weak in all weighted dimensions as 'weak' or 'fair'", () => {
    const portrait = makePortrait()
    const poor = makeListing({
      dimensions: {
        natural_light: 1,   // 20
        privacy: 1,
        noise_level: 1,     // 20
      },
      sqft: 800,            // well below target -> low space score
    })
    const [result] = matchListings(portrait, [poor])
    expect(result.score).toBeLessThan(50)
    expect(result.verdict).toBe("weak")
    expect(verdictFor(result.score)).toBe(result.verdict)
  })

  it("sorts results best-first by score", () => {
    const portrait = makePortrait()
    const great = makeListing({ id: "great", dimensions: { natural_light: 5, privacy: 5, noise_level: 5 }, sqft: 2400 })
    const poor = makeListing({ id: "poor", dimensions: { natural_light: 1, privacy: 1, noise_level: 1 }, sqft: 800 })
    const results = matchListings(portrait, [poor, great])
    expect(results[0].listing.id).toBe("great")
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score)
  })
})

describe("matchListingsEvolved", () => {
  function makeState(weights: { dimension: string; weight: number }[]): PreferenceState {
    const dims = weights.map((w) => ({ dimension: w.dimension, weight: w.weight, confidence: 0.5 }))
    return { current: dims, prior: dims, history: [], evidenceCount: 5 }
  }

  it("overrides portrait priorities with the evolved weights so a light-dominant buyer favors a light-strong home", () => {
    // A listing that is excellent on light but mediocre on space/quiet.
    const lightHome = makeListing({
      id: "light",
      dimensions: { natural_light: 5, privacy: 2, noise_level: 2 },
      sqft: 1200,
    })

    // Intake portrait barely weights light.
    const portrait = makePortrait({
      priorities: [
        { item: "Space & square footage", rank: 1, weight: 0.6 },
        { item: "Privacy & quiet", rank: 2, weight: 0.3 },
        { item: "Natural light & views", rank: 3, weight: 0.1 },
      ],
    })

    const baseline = matchListings(portrait, [lightHome])[0]

    // Evolved weights flip to light-dominant.
    const evolved = makeState([
      { dimension: "Natural light & views", weight: 0.7 },
      { dimension: "Space & square footage", weight: 0.15 },
      { dimension: "Privacy & quiet", weight: 0.15 },
    ])
    const reranked = matchListingsEvolved(portrait, [lightHome], evolved)[0]

    // Because light now dominates the weighting and this home is strong in light,
    // its evolved score must beat the intake-weighted score.
    expect(reranked.score).toBeGreaterThan(baseline.score)
  })

  it("re-ranks two listings: the one strong in the now-dominant dimension moves to the top", () => {
    const lightHome = makeListing({
      id: "light",
      dimensions: { natural_light: 5, privacy: 2, noise_level: 2 },
      sqft: 1200,
    })
    const spaceHome = makeListing({
      id: "space",
      dimensions: { natural_light: 1, privacy: 4, noise_level: 4 },
      sqft: 3200,
    })

    // Intake weights favor space -> spaceHome should win on intake.
    const portrait = makePortrait({
      priorities: [
        { item: "Space & square footage", rank: 1, weight: 0.6 },
        { item: "Privacy & quiet", rank: 2, weight: 0.3 },
        { item: "Natural light & views", rank: 3, weight: 0.1 },
      ],
    })
    const intakeRanked = matchListings(portrait, [lightHome, spaceHome])
    expect(intakeRanked[0].listing.id).toBe("space")

    // After learning that the buyer keeps gravitating toward light, light dominates.
    const evolved = makeState([
      { dimension: "Natural light & views", weight: 0.7 },
      { dimension: "Space & square footage", weight: 0.15 },
      { dimension: "Privacy & quiet", weight: 0.15 },
    ])
    const evolvedRanked = matchListingsEvolved(portrait, [lightHome, spaceHome], evolved)
    expect(evolvedRanked[0].listing.id).toBe("light")
  })
})

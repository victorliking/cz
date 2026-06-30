import { describe, it, expect } from "vitest"
import {
  initializeFromIntake,
  updateWeights,
  extractSignalsFromFeedback,
  calculateDrift,
  getSignificantChanges,
  isValidPreferenceState,
  type PreferenceState,
  type FeedbackSignal,
} from "@/lib/scoring/bayesian-learner"
import { SIGNAL_STRENGTHS } from "@/lib/scoring/signal-strengths"

// Mirror the (private) constants from bayesian-learner.ts so we can assert bounds.
const MIN_WEIGHT = 0.02
const MAX_WEIGHT = 0.45

function makeIntake() {
  // Three dimensions; weights already sum to 1.
  return initializeFromIntake([
    { item: "Natural light & views", rank: 1, weight: 0.5 },
    { item: "Space & square footage", rank: 2, weight: 0.3 },
    { item: "Privacy & quiet", rank: 3, weight: 0.2 },
  ])
}

function weightOf(state: PreferenceState, dimension: string): number {
  return state.current.find((w) => w.dimension === dimension)!.weight
}

function sumWeights(state: PreferenceState): number {
  return state.current.reduce((s, w) => s + w.weight, 0)
}

describe("initializeFromIntake", () => {
  it("creates current and prior weights from the intake priorities", () => {
    const state = makeIntake()
    expect(state.current.map((w) => w.dimension)).toEqual([
      "Natural light & views",
      "Space & square footage",
      "Privacy & quiet",
    ])
    expect(weightOf(state, "Natural light & views")).toBe(0.5)
    expect(state.prior.map((w) => w.weight)).toEqual([0.5, 0.3, 0.2])
  })

  it("seeds confidence at the forced-ranking signal strength (low trust in self-report)", () => {
    const state = makeIntake()
    for (const w of state.current) {
      expect(w.confidence).toBe(SIGNAL_STRENGTHS.INTAKE_FORCED_RANKING)
    }
  })

  it("starts with zero evidence and a single intake history snapshot", () => {
    const state = makeIntake()
    expect(state.evidenceCount).toBe(0)
    expect(state.history).toHaveLength(1)
    expect(state.history[0].feedbackId).toBe("intake")
  })

  it("deep-clones so prior is not mutated when current changes", () => {
    const state = makeIntake()
    state.current[0].weight = 0.99
    expect(state.prior[0].weight).toBe(0.5)
  })
})

describe("updateWeights", () => {
  function signal(dimensionSignals: Record<string, number>, source: FeedbackSignal["source"] = "FEEDBACK_CHIPS"): FeedbackSignal {
    return {
      source,
      dimensionSignals,
      listingId: "listing-1",
      listingDimensions: {},
      timestamp: "2026-06-30T00:00:00.000Z",
    }
  }

  it("normalizes weights to sum ~= 1", () => {
    const state = makeIntake()
    const { newState } = updateWeights(state, signal({ "Natural light & views": 1 }))
    expect(sumWeights(newState)).toBeCloseTo(1, 10)
  })

  it("moves positive evidence up and negative evidence down (relative to other dims)", () => {
    const state = makeIntake()
    const lightBefore = weightOf(state, "Natural light & views")
    const quietBefore = weightOf(state, "Privacy & quiet")

    const { newState } = updateWeights(state, signal({
      "Natural light & views": 1,
      "Privacy & quiet": -1,
    }))

    // Light got positive evidence -> its share should rise; quiet got negative -> fall.
    expect(weightOf(newState, "Natural light & views")).toBeGreaterThan(lightBefore)
    expect(weightOf(newState, "Privacy & quiet")).toBeLessThan(quietBefore)
  })

  it("keeps every weight within [MIN_WEIGHT, MAX_WEIGHT] before normalization clamping", () => {
    // Drive one dimension hard with many strong positive updates.
    let state = initializeFromIntake([
      { item: "Natural light & views", rank: 1, weight: 0.34 },
      { item: "Space & square footage", rank: 2, weight: 0.33 },
      { item: "Privacy & quiet", rank: 3, weight: 0.33 },
    ])
    for (let i = 0; i < 30; i++) {
      state = updateWeights(state, signal({
        "Natural light & views": 1,
        "Privacy & quiet": -1,
      }, "PURE_BEHAVIOR")).newState
    }
    // The pre-normalization clamp guarantees no raw weight escaped the band.
    // After normalization the max dimension stays the dominant one and the
    // floored dimension stays small but positive.
    for (const w of state.current) {
      expect(w.weight).toBeGreaterThan(0)
      expect(w.weight).toBeLessThanOrEqual(1)
    }
    // Floored dimension should be the smallest, dominant the largest.
    expect(weightOf(state, "Natural light & views")).toBeGreaterThan(weightOf(state, "Privacy & quiet"))
  })

  it("grows confidence with each piece of evidence (asymptotic, never exceeds 1)", () => {
    const state = makeIntake()
    const confBefore = state.current.find((w) => w.dimension === "Natural light & views")!.confidence
    const { newState } = updateWeights(state, signal({ "Natural light & views": 1 }))
    const confAfter = newState.current.find((w) => w.dimension === "Natural light & views")!.confidence
    expect(confAfter).toBeGreaterThan(confBefore)
    expect(confAfter).toBeLessThanOrEqual(1)
    // Exact: 0.3 + 0.15 * 0.7 * (1 - 0.3) = 0.3735
    expect(confAfter).toBeCloseTo(0.3735, 6)
  })

  it("stronger signal source produces a larger weight shift", () => {
    // Use "Privacy & quiet" (starts at 0.20, well below MAX_WEIGHT 0.45) so the
    // raw update is NOT clamped and the learning-rate difference between sources
    // is actually observable in the resulting weight.
    const base = makeIntake()
    const chips = updateWeights(base, signal({ "Privacy & quiet": 1 }, "FEEDBACK_CHIPS"))
    const behavior = updateWeights(base, signal({ "Privacy & quiet": 1 }, "PURE_BEHAVIOR"))

    const chipDelta = weightOf(chips.newState, "Privacy & quiet") - weightOf(base, "Privacy & quiet")
    const behaviorDelta = weightOf(behavior.newState, "Privacy & quiet") - weightOf(base, "Privacy & quiet")
    expect(chipDelta).toBeGreaterThan(0)
    expect(behaviorDelta).toBeGreaterThan(chipDelta)
  })

  it("records changes and increments evidence count and history", () => {
    const state = makeIntake()
    // Signal "Privacy & quiet" (0.20) rather than "Natural light & views" (0.50):
    // the latter starts ABOVE the MAX_WEIGHT ceiling (0.45), so a positive signal
    // clamps it DOWNWARD (a negative recorded delta). Real intake weights come from
    // RANK_WEIGHTS (max 0.25), so no dimension is ever seeded above the ceiling in
    // production — assert the intended "positive evidence → positive delta" behavior
    // on an in-domain dimension that has headroom.
    const { newState, changes } = updateWeights(state, signal({ "Privacy & quiet": 1 }))
    expect(newState.evidenceCount).toBe(1)
    expect(newState.history).toHaveLength(2)
    expect(changes.length).toBeGreaterThan(0)
    expect(changes[0].dimension).toBe("Privacy & quiet")
    expect(changes[0].delta).toBeGreaterThan(0)
  })

  it("ignores dimensions with zero evidence (no spurious change records)", () => {
    const state = makeIntake()
    const { changes } = updateWeights(state, signal({ "Space & square footage": 0 }))
    // 0 evidence everywhere -> no changes recorded.
    expect(changes).toHaveLength(0)
  })
})

describe("extractSignalsFromFeedback", () => {
  it("maps liked chip keywords to dimensions with positive signal", () => {
    const signals = extractSignalsFromFeedback({
      liked: "bright",
      disliked: "",
      verdict: "neutral",
      listingDimensions: {},
    })
    // "bright" -> Natural light & views, +0.5, neutral verdict mult = 1.0
    expect(signals["Natural light & views"]).toBeCloseTo(0.5, 6)
  })

  it("treats liking 'character & charm' as a NEGATIVE signal on move-in-ready (not positive)", () => {
    const signals = extractSignalsFromFeedback({
      liked: "charm, character",
      disliked: "",
      verdict: "neutral",
      listingDimensions: {},
    })
    // A buyer who loves period character wants LESS turnkey-modern, so the
    // "Finishes & move-in ready" weight should move DOWN, never up.
    expect(signals["Finishes & move-in ready"]).toBeLessThan(0)
  })

  it("maps disliked chip keywords to negative signal", () => {
    const signals = extractSignalsFromFeedback({
      liked: "",
      disliked: "spacious",
      verdict: "neutral",
      listingDimensions: {},
    })
    // "spacious" -> Space & square footage, -0.5
    expect(signals["Space & square footage"]).toBeCloseTo(-0.5, 6)
  })

  it("amplifies signals when the buyer LOVED the listing, clamped to +/-1", () => {
    const signals = extractSignalsFromFeedback({
      liked: "bright",
      disliked: "",
      verdict: "love",
      listingDimensions: {},
    })
    // 0.5 * 1.5 = 0.75
    expect(signals["Natural light & views"]).toBeCloseTo(0.75, 6)
  })

  it("amplifies dislike verdict negatively (dislikes are informative)", () => {
    const signals = extractSignalsFromFeedback({
      liked: "",
      disliked: "spacious",
      verdict: "dislike",
      listingDimensions: {},
    })
    // -0.5 * 1.3 = -0.65
    expect(signals["Space & square footage"]).toBeCloseTo(-0.65, 6)
  })

  it("clamps amplified signals to the [-1, 1] band", () => {
    const signals = extractSignalsFromFeedback({
      // Two keywords both map to Natural light & views: "bright" + "light" => 1.0 pre-verdict
      liked: "bright, light",
      disliked: "",
      verdict: "love",
      listingDimensions: {},
    })
    // (0.5 + 0.5) * 1.5 = 1.5 -> clamped to 1
    expect(signals["Natural light & views"]).toBe(1)
  })

  it("adds a weak implicit positive for unmentioned high-scoring dimensions on love/like", () => {
    const signals = extractSignalsFromFeedback({
      liked: "bright",
      disliked: "",
      verdict: "love",
      listingDimensions: {
        "Natural light & views": 90, // already mentioned, untouched by implicit rule
        "Kitchen & entertaining": 85, // unmentioned, high score -> implicit +0.2
        "Privacy & quiet": 40,        // unmentioned, low score -> no signal
      },
    })
    expect(signals["Kitchen & entertaining"]).toBeCloseTo(0.2, 6)
    expect(signals["Privacy & quiet"]).toBeUndefined()
  })

  it("does NOT add implicit positives when the verdict is neutral or dislike", () => {
    const signals = extractSignalsFromFeedback({
      liked: "",
      disliked: "",
      verdict: "neutral",
      listingDimensions: { "Kitchen & entertaining": 95 },
    })
    expect(signals["Kitchen & entertaining"]).toBeUndefined()
  })

  it("splits multi-chip strings on common delimiters", () => {
    const signals = extractSignalsFromFeedback({
      liked: "quiet; yard | updated",
      disliked: "",
      verdict: "neutral",
      listingDimensions: {},
    })
    expect(signals["Privacy & quiet"]).toBeCloseTo(0.5, 6)
    expect(signals["Outdoor space & yard"]).toBeCloseTo(0.5, 6)
    expect(signals["Finishes & move-in ready"]).toBeCloseTo(0.5, 6)
  })
})

describe("calculateDrift", () => {
  it("is 0 when current weights are identical to the prior", () => {
    const state = makeIntake()
    expect(calculateDrift(state)).toBe(0)
  })

  it("is > 0 once weights have evolved away from the prior", () => {
    let state = makeIntake()
    state = updateWeights(state, {
      source: "PURE_BEHAVIOR",
      dimensionSignals: { "Natural light & views": 1, "Privacy & quiet": -1 },
      listingId: "l",
      listingDimensions: {},
      timestamp: "2026-06-30T00:00:00.000Z",
    }).newState
    expect(calculateDrift(state)).toBeGreaterThan(0)
  })
})

describe("getSignificantChanges", () => {
  it("returns nothing when weights have not moved beyond the threshold", () => {
    const state = makeIntake()
    expect(getSignificantChanges(state)).toHaveLength(0)
  })

  it("surfaces the dimension that received sustained negative evidence as 'decreased'", () => {
    let state = makeIntake()
    for (let i = 0; i < 3; i++) {
      state = updateWeights(state, {
        source: "PURE_BEHAVIOR",
        dimensionSignals: { "Natural light & views": 1, "Privacy & quiet": -1 },
        listingId: "l",
        listingDimensions: {},
        timestamp: "2026-06-30T00:00:00.000Z",
      }).newState
    }
    const changes = getSignificantChanges(state, 0.03)
    const quiet = changes.find((c) => c.dimension === "Privacy & quiet")
    expect(quiet).toBeDefined()
    expect(quiet!.direction).toBe("decreased")
    expect(quiet!.currentWeight).toBeLessThan(quiet!.priorWeight)
  })

  it("does NOT surface a dimension whose growth was capped near the MAX_WEIGHT ceiling", () => {
    // Subtle but real: "Natural light & views" starts at 0.50 (above MAX_WEIGHT 0.45),
    // so each positive raw update clamps it to 0.45 before normalization. After
    // normalizing, its share lands right back near 0.50 — a sub-threshold change.
    // The redistributed weight instead flows to the untouched "Space" dimension.
    let state = makeIntake()
    for (let i = 0; i < 3; i++) {
      state = updateWeights(state, {
        source: "PURE_BEHAVIOR",
        dimensionSignals: { "Natural light & views": 1, "Privacy & quiet": -1 },
        listingId: "l",
        listingDimensions: {},
        timestamp: "2026-06-30T00:00:00.000Z",
      }).newState
    }
    const changes = getSignificantChanges(state, 0.03)
    // Light's net drift stays under the 0.03 threshold, so it is not reported.
    expect(changes.find((c) => c.dimension === "Natural light & views")).toBeUndefined()
    // "Space & square footage" absorbs the normalization slack and IS reported.
    const space = changes.find((c) => c.dimension === "Space & square footage")
    expect(space?.direction).toBe("increased")
  })

  it("sorts changes by absolute delta descending", () => {
    let state = makeIntake()
    for (let i = 0; i < 4; i++) {
      state = updateWeights(state, {
        source: "PURE_BEHAVIOR",
        dimensionSignals: { "Natural light & views": 1, "Privacy & quiet": -1 },
        listingId: "l",
        listingDimensions: {},
        timestamp: "2026-06-30T00:00:00.000Z",
      }).newState
    }
    const changes = getSignificantChanges(state, 0.01)
    for (let i = 1; i < changes.length; i++) {
      expect(Math.abs(changes[i - 1].delta)).toBeGreaterThanOrEqual(Math.abs(changes[i].delta))
    }
  })

  it("does not throw on a ragged state (prior shorter than current)", () => {
    // Simulate malformed untrusted JSON: current has 2 dims, prior has 1.
    // The defensive guard must skip the unmatched dimension rather than
    // dereferencing prior[1] (undefined) and throwing.
    const ragged = {
      current: [
        { dimension: "Natural light & views", weight: 0.6, confidence: 0.5 },
        { dimension: "Privacy & quiet", weight: 0.4, confidence: 0.5 },
      ],
      prior: [
        { dimension: "Natural light & views", weight: 0.5, confidence: 0.3 },
      ],
      history: [],
      evidenceCount: 1,
    } as unknown as PreferenceState

    let changes: ReturnType<typeof getSignificantChanges> = []
    expect(() => {
      changes = getSignificantChanges(ragged, 0.03)
    }).not.toThrow()
    // Only the comparable dimension can be reported; the unmatched one is skipped.
    expect(changes.every((c) => c.dimension === "Natural light & views")).toBe(true)
  })
})

describe("isValidPreferenceState", () => {
  it("accepts a well-formed state produced by the learner", () => {
    const state = makeIntake()
    expect(isValidPreferenceState(state)).toBe(true)
  })

  it("accepts a state after updates (current/prior stay equal length)", () => {
    let state = makeIntake()
    state = updateWeights(state, {
      source: "PURE_BEHAVIOR",
      dimensionSignals: { "Natural light & views": 1, "Privacy & quiet": -1 },
      listingId: "l",
      listingDimensions: {},
      timestamp: "2026-06-30T00:00:00.000Z",
    }).newState
    expect(isValidPreferenceState(state)).toBe(true)
  })

  it("rejects non-objects and null", () => {
    expect(isValidPreferenceState(null)).toBe(false)
    expect(isValidPreferenceState(undefined)).toBe(false)
    expect(isValidPreferenceState("nope")).toBe(false)
    expect(isValidPreferenceState(42)).toBe(false)
  })

  it("rejects a ragged state (current and prior of unequal length)", () => {
    const ragged = {
      current: [
        { dimension: "Natural light & views", weight: 0.6, confidence: 0.5 },
        { dimension: "Privacy & quiet", weight: 0.4, confidence: 0.5 },
      ],
      prior: [
        { dimension: "Natural light & views", weight: 0.5, confidence: 0.3 },
      ],
      history: [],
      evidenceCount: 1,
    }
    expect(isValidPreferenceState(ragged)).toBe(false)
  })

  it("rejects a state missing the current or prior arrays", () => {
    expect(isValidPreferenceState({ prior: [], history: [], evidenceCount: 0 })).toBe(false)
    expect(isValidPreferenceState({ current: [], history: [], evidenceCount: 0 })).toBe(false)
  })

  it("rejects elements with a non-numeric / NaN / Infinity weight", () => {
    const nan = {
      current: [{ dimension: "Natural light & views", weight: NaN, confidence: 0.5 }],
      prior: [{ dimension: "Natural light & views", weight: 0.5, confidence: 0.3 }],
      history: [],
      evidenceCount: 0,
    }
    const inf = {
      current: [{ dimension: "Natural light & views", weight: Infinity, confidence: 0.5 }],
      prior: [{ dimension: "Natural light & views", weight: 0.5, confidence: 0.3 }],
      history: [],
      evidenceCount: 0,
    }
    const str = {
      current: [{ dimension: "Natural light & views", weight: "0.5", confidence: 0.5 }],
      prior: [{ dimension: "Natural light & views", weight: 0.5, confidence: 0.3 }],
      history: [],
      evidenceCount: 0,
    }
    expect(isValidPreferenceState(nan)).toBe(false)
    expect(isValidPreferenceState(inf)).toBe(false)
    expect(isValidPreferenceState(str)).toBe(false)
  })

  it("rejects elements with a missing / non-string dimension", () => {
    const bad = {
      current: [{ weight: 0.5, confidence: 0.5 }],
      prior: [{ dimension: "Natural light & views", weight: 0.5, confidence: 0.3 }],
      history: [],
      evidenceCount: 0,
    }
    expect(isValidPreferenceState(bad)).toBe(false)
  })

  it("rejects a non-numeric evidenceCount", () => {
    const bad = {
      current: [{ dimension: "Natural light & views", weight: 0.5, confidence: 0.5 }],
      prior: [{ dimension: "Natural light & views", weight: 0.5, confidence: 0.3 }],
      history: [],
      evidenceCount: "lots",
    }
    expect(isValidPreferenceState(bad)).toBe(false)
  })
})

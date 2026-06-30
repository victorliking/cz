/**
 * Bayesian Preference Learner
 * 
 * Evolves buyer priority weights based on showing feedback.
 * Uses signal-strength hierarchy to weight evidence sources differently:
 *   - Intake forced ranking (prior): 0.3
 *   - Post-showing chips: 0.7
 *   - Comparative A vs B: 0.8
 *   - Agent observation: 0.9
 *   - Pure behavior (revisit, budget stretch): 1.0
 *
 * Algorithm: Exponential moving average with signal-strength-weighted learning rate
 * 
 * w_new[i] = w_old[i] + α * signal_strength * evidence[i]
 * then normalize so Σw = 1
 * 
 * Where evidence[i] is derived from:
 *   +1 if buyer liked a dimension that was strong in the listing
 *   -1 if buyer disliked a dimension that was strong in the listing
 *   +0.5 if buyer liked a dimension that was weak (reveals hidden priority)
 *   0 if no signal for this dimension
 */

import { SIGNAL_STRENGTHS, type SignalSource } from "./signal-strengths"

// --- Types ---

export interface DimensionWeight {
  dimension: string
  weight: number
  confidence: number  // 0-1, increases with more evidence
}

export interface FeedbackSignal {
  source: SignalSource
  /** Which dimensions this feedback relates to (positive = liked, negative = disliked) */
  dimensionSignals: Record<string, number>  // dimension → [-1, +1]
  /** The listing that was shown */
  listingId: string
  /** Listing's dimension scores for context */
  listingDimensions: Record<string, number>  // dimension → score (0-100)
  timestamp: string
}

export interface WeightSnapshot {
  weights: DimensionWeight[]
  timestamp: string
  trigger: string  // What caused this snapshot (e.g., "Showing: 42 Main St")
  feedbackId: string
}

export interface PreferenceState {
  /** Current evolved weights */
  current: DimensionWeight[]
  /** Initial weights from intake (the prior) */
  prior: DimensionWeight[]
  /** History of all weight snapshots */
  history: WeightSnapshot[]
  /** Total evidence count */
  evidenceCount: number
}

// --- Validation ---

/** True iff `w` is a well-formed DimensionWeight (dimension string + finite numeric weight). */
function isDimensionWeight(w: unknown): w is DimensionWeight {
  if (typeof w !== "object" || w === null) return false
  const dw = w as Record<string, unknown>
  return (
    typeof dw.dimension === "string" &&
    typeof dw.weight === "number" &&
    Number.isFinite(dw.weight)
  )
}

/**
 * Runtime shape guard for PreferenceState read from untrusted JSON
 * (IntakeResponse.answers._preferenceState is buyer-influenced and not schema-validated).
 *
 * Verifies the invariant the scoring code relies on: `current` and `prior` are
 * arrays of EQUAL length, every element is a well-formed DimensionWeight
 * (dimension:string + finite weight:number), and `evidenceCount` is a finite
 * number. Callers should treat a `false` result as "no learned state" and fall
 * back to the static intake weights rather than risk a throw downstream.
 */
export function isValidPreferenceState(x: unknown): x is PreferenceState {
  if (typeof x !== "object" || x === null) return false
  const s = x as Record<string, unknown>

  if (!Array.isArray(s.current) || !Array.isArray(s.prior)) return false
  if (s.current.length !== s.prior.length) return false

  if (typeof s.evidenceCount !== "number" || !Number.isFinite(s.evidenceCount)) return false

  for (const w of s.current) {
    if (!isDimensionWeight(w)) return false
  }
  for (const w of s.prior) {
    if (!isDimensionWeight(w)) return false
  }

  return true
}

// --- Constants ---

/** Base learning rate — how much a single feedback shifts weights */
const BASE_LEARNING_RATE = 0.12

/** Minimum weight floor — no dimension can go below this */
const MIN_WEIGHT = 0.02

/** Maximum weight ceiling — no single dimension can dominate */
const MAX_WEIGHT = 0.45

/** Confidence growth per evidence unit (asymptotic) */
const CONFIDENCE_GROWTH = 0.15

// --- Core Algorithm ---

/**
 * Initialize preference state from intake questionnaire results.
 * These are the Bayesian prior — low confidence (0.3 signal strength).
 */
export function initializeFromIntake(
  priorities: { item: string; rank: number; weight: number }[]
): PreferenceState {
  const initial: DimensionWeight[] = priorities.map(p => ({
    dimension: p.item,
    weight: p.weight,
    confidence: SIGNAL_STRENGTHS.INTAKE_FORCED_RANKING, // 0.3 — we don't fully trust self-report
  }))

  return {
    current: structuredClone(initial),
    prior: structuredClone(initial),
    history: [{
      weights: structuredClone(initial),
      timestamp: new Date().toISOString(),
      trigger: "Initial intake questionnaire",
      feedbackId: "intake",
    }],
    evidenceCount: 0,
  }
}

/**
 * Update weights based on new feedback signal.
 * This is the core Bayesian update step.
 * 
 * Returns the new preference state and a description of what changed.
 */
export function updateWeights(
  state: PreferenceState,
  signal: FeedbackSignal
): { newState: PreferenceState; changes: WeightChange[] } {
  const signalStrength = SIGNAL_STRENGTHS[signal.source]
  const learningRate = BASE_LEARNING_RATE * signalStrength
  
  const changes: WeightChange[] = []
  const newWeights = structuredClone(state.current)

  for (const dw of newWeights) {
    const evidenceValue = signal.dimensionSignals[dw.dimension] || 0
    
    if (evidenceValue === 0) continue // No signal for this dimension

    const oldWeight = dw.weight
    
    // Apply update: weight shifts toward evidence direction
    // Positive evidence → increase weight (buyer cares about this more than stated)
    // Negative evidence → decrease weight (buyer cares about this less than stated)
    const delta = learningRate * evidenceValue
    dw.weight = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, dw.weight + delta))
    
    // Confidence increases with each piece of evidence (asymptotic to 1.0)
    dw.confidence = Math.min(1.0, dw.confidence + CONFIDENCE_GROWTH * signalStrength * (1 - dw.confidence))

    if (Math.abs(dw.weight - oldWeight) > 0.005) {
      changes.push({
        dimension: dw.dimension,
        oldWeight,
        newWeight: dw.weight,
        delta: dw.weight - oldWeight,
        reason: evidenceValue > 0
          ? `Buyer showed positive response to ${dw.dimension.toLowerCase()}`
          : `Buyer showed negative response to ${dw.dimension.toLowerCase()}`,
        signalSource: signal.source,
        signalStrength,
      })
    }
  }

  // Normalize weights to sum to 1
  normalizeWeights(newWeights)

  const snapshot: WeightSnapshot = {
    weights: structuredClone(newWeights),
    timestamp: signal.timestamp,
    trigger: `Showing feedback (${signal.source})`,
    feedbackId: signal.listingId,
  }

  const newState: PreferenceState = {
    current: newWeights,
    prior: state.prior,
    history: [...state.history, snapshot],
    evidenceCount: state.evidenceCount + 1,
  }

  return { newState, changes }
}

/**
 * Process raw showing feedback into dimension signals.
 * Maps user's liked/disliked chips to our dimension taxonomy.
 */
export function extractSignalsFromFeedback(feedback: {
  liked: string
  disliked: string
  verdict: "love" | "like" | "neutral" | "dislike"
  listingDimensions: Record<string, number>
}): Record<string, number> {
  const signals: Record<string, number> = {}
  
  // Map chip keywords to dimensions
  const CHIP_TO_DIMENSION: Record<string, string> = {
    // Positive chips
    "bright": "Natural light & views",
    "light": "Natural light & views",
    "sunny": "Natural light & views",
    "south-facing": "Natural light & views",
    "quiet": "Privacy & quiet",
    "private": "Privacy & quiet",
    "peaceful": "Privacy & quiet",
    "spacious": "Space & square footage",
    "big": "Space & square footage",
    "roomy": "Space & square footage",
    "open": "Space & square footage",
    "kitchen": "Kitchen & entertaining",
    "cooking": "Kitchen & entertaining",
    "island": "Kitchen & entertaining",
    "entertaining": "Kitchen & entertaining",
    "yard": "Outdoor space & yard",
    "garden": "Outdoor space & yard",
    "outdoor": "Outdoor space & yard",
    "patio": "Outdoor space & yard",
    "deck": "Outdoor space & yard",
    "school": "Schools & family-friendliness",
    "family": "Schools & family-friendliness",
    "kids": "Schools & family-friendliness",
    "safe": "Schools & family-friendliness",
    "walkable": "Location & commute",
    "transit": "Location & commute",
    "commute": "Location & commute",
    "location": "Location & commute",
    "close": "Location & commute",
    "updated": "Finishes & move-in ready",
    "renovated": "Finishes & move-in ready",
    "modern": "Finishes & move-in ready",
    "new": "Finishes & move-in ready",
    "move-in": "Finishes & move-in ready",
    "charm": "Finishes & move-in ready",
    "character": "Finishes & move-in ready",
  }

  // Process liked chips
  const likedWords = feedback.liked.toLowerCase().split(/[,;|\n]+/).map(s => s.trim())
  for (const word of likedWords) {
    for (const [keyword, dimension] of Object.entries(CHIP_TO_DIMENSION)) {
      if (word.includes(keyword)) {
        signals[dimension] = (signals[dimension] || 0) + 0.5
      }
    }
  }

  // Process disliked chips
  const dislikedWords = feedback.disliked.toLowerCase().split(/[,;|\n]+/).map(s => s.trim())
  for (const word of dislikedWords) {
    for (const [keyword, dimension] of Object.entries(CHIP_TO_DIMENSION)) {
      if (word.includes(keyword)) {
        signals[dimension] = (signals[dimension] || 0) - 0.5
      }
    }
  }

  // Verdict amplification: if they loved/hated the whole listing,
  // amplify the strongest dimension signals
  const verdictMultiplier = 
    feedback.verdict === "love" ? 1.5 :
    feedback.verdict === "like" ? 1.2 :
    feedback.verdict === "dislike" ? 1.3 :  // Dislikes are informative too
    1.0

  // Apply verdict amplification
  for (const dim of Object.keys(signals)) {
    signals[dim] = Math.max(-1, Math.min(1, signals[dim] * verdictMultiplier))
  }

  // If buyer LOVED the listing but didn't mention a dimension that scored high,
  // give it a small positive signal (implicit preference)
  if (feedback.verdict === "love" || feedback.verdict === "like") {
    for (const [dim, score] of Object.entries(feedback.listingDimensions)) {
      if (score >= 70 && !signals[dim]) {
        signals[dim] = 0.2 // Weak implicit positive
      }
    }
  }

  return signals
}

// --- Helpers ---

function normalizeWeights(weights: DimensionWeight[]): void {
  const sum = weights.reduce((s, w) => s + w.weight, 0)
  if (sum === 0) return
  for (const w of weights) {
    w.weight = w.weight / sum
  }
}

export interface WeightChange {
  dimension: string
  oldWeight: number
  newWeight: number
  delta: number
  reason: string
  signalSource: SignalSource
  signalStrength: number
}

/**
 * Calculate how much the current weights have drifted from the prior.
 * Returns a drift score (0 = no change, 1 = completely different).
 * Uses Jensen-Shannon divergence (symmetric, bounded 0-1).
 */
export function calculateDrift(state: PreferenceState): number {
  const p = state.prior.map(w => w.weight)
  const q = state.current.map(w => w.weight)
  
  // Jensen-Shannon Divergence
  const m = p.map((pi, i) => (pi + q[i]) / 2)
  const klPM = klDivergence(p, m)
  const klQM = klDivergence(q, m)
  
  return (klPM + klQM) / 2
}

function klDivergence(p: number[], q: number[]): number {
  let sum = 0
  for (let i = 0; i < p.length; i++) {
    if (p[i] > 0 && q[i] > 0) {
      sum += p[i] * Math.log2(p[i] / q[i])
    }
  }
  return sum
}

/**
 * Get the most significant weight changes between prior and current.
 * These are the "preference evolutions" we'll surface to the buyer.
 */
export function getSignificantChanges(
  state: PreferenceState,
  threshold: number = 0.03
): PreferenceEvolution[] {
  const evolutions: PreferenceEvolution[] = []

  for (let i = 0; i < state.current.length; i++) {
    const curr = state.current[i]
    const prior = state.prior[i]
    // Defensive: a ragged state (prior shorter than current, or a malformed
    // element) must never throw here — skip dimensions we can't compare.
    if (!prior || typeof prior.weight !== "number") continue
    const delta = curr.weight - prior.weight

    if (Math.abs(delta) >= threshold) {
      evolutions.push({
        dimension: curr.dimension,
        priorWeight: prior.weight,
        currentWeight: curr.weight,
        delta,
        direction: delta > 0 ? "increased" : "decreased",
        confidence: curr.confidence,
        interpretation: interpretChange(curr.dimension, delta, curr.confidence),
      })
    }
  }

  return evolutions.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
}

export interface PreferenceEvolution {
  dimension: string
  priorWeight: number
  currentWeight: number
  delta: number
  direction: "increased" | "decreased"
  confidence: number
  interpretation: string
}

function interpretChange(dimension: string, delta: number, confidence: number): string {
  const direction = delta > 0 ? "more" : "less"
  const magnitude = Math.abs(delta) > 0.08 ? "significantly" : "somewhat"
  const confText = confidence >= 0.7 ? "Based on consistent signals" : "Early indication"
  
  const dimensionName = dimension.toLowerCase()
  
  if (delta > 0.08) {
    return `${confText}: ${dimensionName} matters to you ${magnitude} ${direction} than you initially stated. Your reactions to homes consistently light up when this dimension is strong.`
  } else if (delta > 0.03) {
    return `${confText}: You seem to value ${dimensionName} ${direction} than your initial ranking suggested. We've noticed a pattern in your showing reactions.`
  } else if (delta < -0.08) {
    return `${confText}: Despite ranking ${dimensionName} high initially, your actual reactions suggest it's ${direction} critical to your decision than other factors.`
  } else {
    return `${confText}: ${dimensionName} appears ${magnitude} ${direction} important based on your showing feedback.`
  }
}

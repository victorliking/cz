/**
 * Stated vs. Revealed Preference Mismatch Detector
 *
 * Analyzes the gap between what a buyer said at intake (stated preferences)
 * and how they actually behave during showings (revealed preferences).
 *
 * Detects:
 * - Priority drift: Top-ranked dimension drops below average after evidence
 * - Hidden priority: Low-ranked dimension rises above average
 * - Budget drift: Positive feedback on over-budget homes
 * - Contradiction patterns: Specific stated-vs-behavior mismatches
 */

import type { PreferenceState, DimensionWeight } from "@/lib/scoring/bayesian-learner"

// --- Types ---

export type MismatchKind =
  | "PRIORITY_DRIFT"
  | "HIDDEN_PRIORITY"
  | "BUDGET_DRIFT"
  | "CONTRADICTION"

export interface MismatchInsight {
  kind: MismatchKind
  dimension: string
  statedRank: number
  revealedRank: number
  confidence: number
  evidenceCount: number
  message: string
  agentPrompt: string
}

export interface IntakeContext {
  priorityRanking: string[]
  budgetMax: number | null
  dealBreakers: string[]
  targetCities: string[]
}

export interface FeedbackHistory {
  id: string
  verdict: string
  liked: string
  disliked: string
  listPrice?: number
  city?: string
  address?: string
}

// --- Core Detection ---

/**
 * Detect mismatches between stated and revealed preferences.
 * Should only be called when evidenceCount >= 3 (need enough signal).
 */
export function detectMismatches(
  state: PreferenceState,
  intakeContext: IntakeContext,
  feedbackHistory: FeedbackHistory[]
): MismatchInsight[] {
  const insights: MismatchInsight[] = []

  if (state.evidenceCount < 3) return insights

  // Calculate average weight for threshold comparisons
  const avgWeight = state.current.reduce((sum, w) => sum + w.weight, 0) / state.current.length

  // Sort by weight to get current ranking
  const currentSorted = [...state.current].sort((a, b) => b.weight - a.weight)
  const currentRankMap = new Map<string, number>()
  currentSorted.forEach((w, i) => currentRankMap.set(w.dimension, i + 1))

  // Build stated rank map from intake priority ranking
  const statedRankMap = new Map<string, number>()
  intakeContext.priorityRanking.forEach((dim, i) => statedRankMap.set(dim, i + 1))

  // --- Priority Drift Detection ---
  const priorityDrifts = detectPriorityDrift(
    state, intakeContext, currentRankMap, statedRankMap, avgWeight
  )
  insights.push(...priorityDrifts)

  // --- Hidden Priority Detection ---
  const hiddenPriorities = detectHiddenPriority(
    state, intakeContext, currentRankMap, statedRankMap, avgWeight
  )
  insights.push(...hiddenPriorities)

  // --- Budget Drift Detection ---
  const budgetDrift = detectBudgetDrift(intakeContext, feedbackHistory)
  if (budgetDrift) insights.push(budgetDrift)

  // --- Contradiction Patterns ---
  const contradictions = detectContradictions(
    intakeContext, feedbackHistory, state
  )
  insights.push(...contradictions)

  return insights
}

// --- Priority Drift ---

function detectPriorityDrift(
  state: PreferenceState,
  intakeContext: IntakeContext,
  currentRankMap: Map<string, number>,
  statedRankMap: Map<string, number>,
  avgWeight: number
): MismatchInsight[] {
  const results: MismatchInsight[] = []
  const totalDimensions = intakeContext.priorityRanking.length

  // Look at top 2 stated priorities that have dropped below average
  for (const dim of intakeContext.priorityRanking.slice(0, 2)) {
    const currentWeight = state.current.find(w => w.dimension === dim)
    if (!currentWeight) continue

    const statedRank = statedRankMap.get(dim) || 0
    const currentRank = currentRankMap.get(dim) || totalDimensions
    const confidence = currentWeight.confidence

    // Must have dropped below average weight AND moved down significantly
    if (currentWeight.weight < avgWeight && currentRank > Math.ceil(totalDimensions / 2)) {
      const insight: MismatchInsight = {
        kind: "PRIORITY_DRIFT",
        dimension: dim,
        statedRank,
        revealedRank: currentRank,
        confidence,
        evidenceCount: state.evidenceCount,
        message: `${dim} was ranked #${statedRank} at intake but has dropped to #${currentRank} based on showing reactions. The buyer stated this was critical, but their feedback doesn't reflect strong responses to it.`,
        agentPrompt: generatePriorityDriftPrompt(dim, statedRank, currentRank),
      }
      results.push(insight)
    }
  }

  return results
}

function generatePriorityDriftPrompt(dim: string, statedRank: number, currentRank: number): string {
  const dimLower = dim.toLowerCase()
  return `Consider asking the buyer if ${dimLower} is truly a dealbreaker, or if they'd accept a trade-off here for strengths in other areas. They ranked it #${statedRank} but their reactions to ${currentRank - statedRank}+ showings suggest other factors are driving their decisions more. A gentle check-in could recalibrate the search.`
}

// --- Hidden Priority ---

function detectHiddenPriority(
  state: PreferenceState,
  intakeContext: IntakeContext,
  currentRankMap: Map<string, number>,
  statedRankMap: Map<string, number>,
  avgWeight: number
): MismatchInsight[] {
  const results: MismatchInsight[] = []
  const totalDimensions = intakeContext.priorityRanking.length

  // Look at bottom-ranked dimensions (6-8) that have risen above average
  const bottomDimensions = intakeContext.priorityRanking.slice(
    Math.max(0, totalDimensions - 3)
  )

  for (const dim of bottomDimensions) {
    const currentWeight = state.current.find(w => w.dimension === dim)
    if (!currentWeight) continue

    const statedRank = statedRankMap.get(dim) || totalDimensions
    const currentRank = currentRankMap.get(dim) || totalDimensions
    const confidence = currentWeight.confidence

    // Must have risen above average weight AND moved up significantly
    if (currentWeight.weight > avgWeight && currentRank <= Math.ceil(totalDimensions / 2)) {
      const insight: MismatchInsight = {
        kind: "HIDDEN_PRIORITY",
        dimension: dim,
        statedRank,
        revealedRank: currentRank,
        confidence,
        evidenceCount: state.evidenceCount,
        message: `${dim} was ranked #${statedRank} at intake (low priority) but has risen to #${currentRank} based on actual reactions. The buyer may not have realized how much this matters to them until they experienced it in homes.`,
        agentPrompt: generateHiddenPriorityPrompt(dim, statedRank, currentRank),
      }
      results.push(insight)
    }
  }

  return results
}

function generateHiddenPriorityPrompt(dim: string, statedRank: number, currentRank: number): string {
  const dimLower = dim.toLowerCase()
  return `The buyer didn't think ${dimLower} mattered much (ranked #${statedRank}), but their showing reactions tell a different story — it's now behaving like a #${currentRank} priority. Consider surfacing listings that are strong on ${dimLower}, and mention this pattern to the buyer. They may want to explicitly elevate it in their criteria.`
}

// --- Budget Drift ---

function detectBudgetDrift(
  intakeContext: IntakeContext,
  feedbackHistory: FeedbackHistory[]
): MismatchInsight | null {
  if (!intakeContext.budgetMax || feedbackHistory.length < 3) return null

  const overBudgetPositive = feedbackHistory.filter(f => {
    const isPositive = f.verdict === "love" || f.verdict === "like"
    const isOverBudget = f.listPrice && f.listPrice > intakeContext.budgetMax!
    return isPositive && isOverBudget
  })

  // Need at least 2 positive reactions to over-budget homes
  if (overBudgetPositive.length < 2) return null

  const ratio = overBudgetPositive.length / feedbackHistory.filter(
    f => f.verdict === "love" || f.verdict === "like"
  ).length

  // At least 40% of positive reactions are to over-budget homes
  if (ratio < 0.4) return null

  const avgOverBudget = overBudgetPositive.reduce(
    (sum, f) => sum + (f.listPrice || 0), 0
  ) / overBudgetPositive.length

  const overBy = Math.round(((avgOverBudget - intakeContext.budgetMax) / intakeContext.budgetMax) * 100)

  const confidence = Math.min(0.9, 0.5 + overBudgetPositive.length * 0.1)

  return {
    kind: "BUDGET_DRIFT",
    dimension: "Budget",
    statedRank: 0,
    revealedRank: 0,
    confidence,
    evidenceCount: overBudgetPositive.length,
    message: `The buyer stated a max budget of $${intakeContext.budgetMax.toLocaleString()}, but ${overBudgetPositive.length} of their positive reactions are to homes averaging ${overBy}% over budget. Their real comfort zone may be higher than stated.`,
    agentPrompt: `The buyer's positive reactions cluster around homes ~${overBy}% above their stated max ($${intakeContext.budgetMax.toLocaleString()}). Consider asking if their budget has flexibility, or if they'd like to adjust the ceiling. Show them homes in the $${Math.round(avgOverBudget / 1000) * 1000} range and see if the reaction pattern continues.`,
  }
}

// --- Contradiction Patterns ---

function detectContradictions(
  intakeContext: IntakeContext,
  feedbackHistory: FeedbackHistory[],
  state: PreferenceState
): MismatchInsight[] {
  const results: MismatchInsight[] = []

  // Pattern: Said "quiet" matters but positive on busy-street homes
  const wantsQuiet = intakeContext.dealBreakers.some(
    d => d.toLowerCase().includes("noise") || d.toLowerCase().includes("noisy")
  ) || intakeContext.priorityRanking.slice(0, 3).includes("Privacy & quiet")

  if (wantsQuiet) {
    const positiveWithNoiseIssue = feedbackHistory.filter(f => {
      const isPositive = f.verdict === "love" || f.verdict === "like"
      const mentionsNoise = f.disliked?.toLowerCase().includes("noise") ||
        f.disliked?.toLowerCase().includes("busy") ||
        f.disliked?.toLowerCase().includes("traffic")
      // Positive despite noise concern, or no complaint about noise on a busy street
      return isPositive && !mentionsNoise && (
        f.address?.toLowerCase().includes("main") ||
        f.address?.toLowerCase().includes("ave") ||
        f.address?.toLowerCase().includes("route")
      )
    })

    if (positiveWithNoiseIssue.length >= 2) {
      const statedRank = intakeContext.priorityRanking.indexOf("Privacy & quiet") + 1
      const currentRank = [...state.current]
        .sort((a, b) => b.weight - a.weight)
        .findIndex(w => w.dimension === "Privacy & quiet") + 1

      results.push({
        kind: "CONTRADICTION",
        dimension: "Privacy & quiet",
        statedRank: statedRank || 0,
        revealedRank: currentRank || 0,
        confidence: Math.min(0.8, 0.5 + positiveWithNoiseIssue.length * 0.1),
        evidenceCount: positiveWithNoiseIssue.length,
        message: `The buyer said quiet/privacy is critical, but gave positive reactions to ${positiveWithNoiseIssue.length} homes on potentially busy streets without mentioning noise as a negative. They may tolerate more street activity than they think.`,
        agentPrompt: `The buyer stated quiet is important but hasn't penalized homes on busier streets. Consider testing this: show a home that's excellent in other dimensions but on a moderately busy road. If they still love it, quiet may be negotiable for the right home.`,
      })
    }
  }

  // Pattern: Said "schools" matter but tours lower-rated districts
  const wantsSchools = intakeContext.priorityRanking.slice(0, 3).includes("Schools & family-friendliness")

  if (wantsSchools) {
    // Check if positive feedback comes from cities not known for top schools
    // This is a simplified check — in production would use actual school data
    const positiveCount = feedbackHistory.filter(
      f => f.verdict === "love" || f.verdict === "like"
    ).length

    if (positiveCount >= 3) {
      const schoolDimWeight = state.current.find(
        w => w.dimension === "Schools & family-friendliness"
      )

      if (schoolDimWeight) {
        const avgWeight = state.current.reduce((sum, w) => sum + w.weight, 0) / state.current.length
        const statedRank = intakeContext.priorityRanking.indexOf("Schools & family-friendliness") + 1
        const currentRank = [...state.current]
          .sort((a, b) => b.weight - a.weight)
          .findIndex(w => w.dimension === "Schools & family-friendliness") + 1

        // Only flag if schools weight has dropped significantly from stated position
        if (schoolDimWeight.weight < avgWeight * 0.8 && statedRank <= 3) {
          results.push({
            kind: "CONTRADICTION",
            dimension: "Schools & family-friendliness",
            statedRank,
            revealedRank: currentRank,
            confidence: schoolDimWeight.confidence,
            evidenceCount: positiveCount,
            message: `Schools were ranked #${statedRank} at intake, but the buyer's positive reactions don't strongly correlate with school quality. They may accept a 7-rated district for the right home overall.`,
            agentPrompt: `Consider asking the buyer if school ratings are truly a dealbreaker, or if they'd accept a 7-rated district for the right home. Their showing reactions suggest other factors (likely the top-weighted dimensions) override school quality when everything else clicks.`,
          })
        }
      }
    }
  }

  return results
}

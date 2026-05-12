/**
 * Preference Evolution Report Generator
 * 
 * Generates a human-readable report showing:
 * 1. How buyer's preferences evolved from intake → current (after showings)
 * 2. Which showings caused the biggest shifts
 * 3. Asks buyer to verify/confirm the new weights
 * 
 * This is the "mirror" — showing buyers what they actually care about
 * based on their behavior, vs. what they said at intake.
 */

import {
  type PreferenceState,
  type PreferenceEvolution,
  type WeightSnapshot,
  getSignificantChanges,
  calculateDrift,
} from "./bayesian-learner"

// --- Types ---

export interface PreferenceReport {
  /** Summary paragraph */
  summary: string
  /** Overall drift score (0 = no change, higher = more evolution) */
  driftScore: number
  /** Human-friendly drift label */
  driftLabel: string
  /** Significant changes ordered by magnitude */
  evolutions: PreferenceEvolution[]
  /** Current weights (for verification) */
  currentWeights: { dimension: string; weight: number; rank: number; confidence: number }[]
  /** Comparison table: before vs after */
  comparison: ComparisonRow[]
  /** Showings that caused the most change */
  pivotalMoments: PivotalMoment[]
  /** Questions to ask buyer for verification */
  verificationQuestions: string[]
}

export interface ComparisonRow {
  dimension: string
  intakeRank: number
  intakeWeight: number
  currentRank: number
  currentWeight: number
  delta: number
  arrow: "↑" | "↓" | "→"
  explanation: string
}

export interface PivotalMoment {
  timestamp: string
  trigger: string
  feedbackId: string
  /** Which dimensions shifted most at this point */
  shifts: { dimension: string; delta: number }[]
}

// --- Main Generator ---

export function generatePreferenceReport(state: PreferenceState): PreferenceReport {
  const evolutions = getSignificantChanges(state, 0.02)
  const driftScore = calculateDrift(state)
  const driftLabel = getDriftLabel(driftScore)

  // Build comparison table
  const comparison = buildComparison(state)

  // Identify pivotal moments from history
  const pivotalMoments = findPivotalMoments(state)

  // Generate summary
  const summary = generateSummary(evolutions, state.evidenceCount, driftLabel)

  // Generate verification questions
  const verificationQuestions = generateVerificationQuestions(evolutions)

  // Current weights sorted by weight (rank)
  const sorted = [...state.current].sort((a, b) => b.weight - a.weight)
  const currentWeights = sorted.map((dw, i) => ({
    dimension: dw.dimension,
    weight: dw.weight,
    rank: i + 1,
    confidence: dw.confidence,
  }))

  return {
    summary,
    driftScore,
    driftLabel,
    evolutions,
    currentWeights,
    comparison,
    pivotalMoments,
    verificationQuestions,
  }
}

// --- Helpers ---

function getDriftLabel(drift: number): string {
  if (drift < 0.01) return "Stable — your stated preferences match your behavior"
  if (drift < 0.05) return "Slight evolution — minor adjustments based on showings"
  if (drift < 0.12) return "Moderate shift — some preferences revealed through experience"
  if (drift < 0.25) return "Significant discovery — your priorities look different now"
  return "Major re-evaluation — what you want is quite different from what you said"
}

function buildComparison(state: PreferenceState): ComparisonRow[] {
  const priorSorted = [...state.prior].sort((a, b) => b.weight - a.weight)
  const currentSorted = [...state.current].sort((a, b) => b.weight - a.weight)

  return state.prior.map((prior, i) => {
    const curr = state.current[i]
    const delta = curr.weight - prior.weight
    const intakeRank = priorSorted.findIndex(p => p.dimension === prior.dimension) + 1
    const currentRank = currentSorted.findIndex(p => p.dimension === curr.dimension) + 1

    const arrow: "↑" | "↓" | "→" = 
      delta > 0.02 ? "↑" :
      delta < -0.02 ? "↓" : "→"

    const explanation = getComparisonExplanation(prior.dimension, intakeRank, currentRank, delta)

    return {
      dimension: prior.dimension,
      intakeRank,
      intakeWeight: prior.weight,
      currentRank,
      currentWeight: curr.weight,
      delta,
      arrow,
      explanation,
    }
  }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
}

function getComparisonExplanation(
  dimension: string,
  intakeRank: number,
  currentRank: number,
  delta: number
): string {
  if (Math.abs(delta) < 0.02) {
    return `Consistent — ${dimension.toLowerCase()} stayed about where you ranked it.`
  }

  const rankDiff = intakeRank - currentRank // positive = moved up
  const dir = delta > 0 ? "more" : "less"
  const dimLower = dimension.toLowerCase()

  if (rankDiff >= 3) {
    return `Big discovery: ${dimLower} jumped from #${intakeRank} to #${currentRank}. Your reactions to homes show this matters much ${dir} than you initially thought.`
  }
  if (rankDiff >= 1) {
    return `${dimLower} moved up from #${intakeRank} to #${currentRank}. You consistently respond positively when this is strong.`
  }
  if (rankDiff <= -3) {
    return `Surprise: You ranked ${dimLower} at #${intakeRank} but your actual reactions suggest it's closer to #${currentRank}. Other factors seem to drive your decisions more.`
  }
  if (rankDiff <= -1) {
    return `${dimLower} dropped slightly from #${intakeRank} to #${currentRank}. It matters, but perhaps ${dir} than you stated.`
  }
  return `${dimLower} importance is ${dir} than stated, though rank is unchanged.`
}

function findPivotalMoments(state: PreferenceState): PivotalMoment[] {
  const moments: PivotalMoment[] = []

  for (let i = 1; i < state.history.length; i++) {
    const prev = state.history[i - 1]
    const curr = state.history[i]

    const shifts: { dimension: string; delta: number }[] = []
    for (let j = 0; j < curr.weights.length; j++) {
      const delta = curr.weights[j].weight - prev.weights[j].weight
      if (Math.abs(delta) > 0.01) {
        shifts.push({ dimension: curr.weights[j].dimension, delta })
      }
    }

    if (shifts.length > 0) {
      moments.push({
        timestamp: curr.timestamp,
        trigger: curr.trigger,
        feedbackId: curr.feedbackId,
        shifts: shifts.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3),
      })
    }
  }

  // Return top 5 most impactful moments
  return moments
    .sort((a, b) => {
      const aMag = a.shifts.reduce((s, x) => s + Math.abs(x.delta), 0)
      const bMag = b.shifts.reduce((s, x) => s + Math.abs(x.delta), 0)
      return bMag - aMag
    })
    .slice(0, 5)
}

function generateSummary(
  evolutions: PreferenceEvolution[],
  evidenceCount: number,
  driftLabel: string
): string {
  if (evidenceCount === 0) {
    return "No showing feedback yet. Your current match weights are based solely on your intake questionnaire. After a few showings, we'll be able to show you how your real preferences compare to what you stated."
  }

  if (evolutions.length === 0) {
    return `After ${evidenceCount} showing${evidenceCount > 1 ? 's' : ''}, your stated preferences align well with your actual reactions. What you said you want is what you respond to in practice. This is a strong signal — your priorities are clear and consistent.`
  }

  const topIncrease = evolutions.find(e => e.direction === "increased")
  const topDecrease = evolutions.find(e => e.direction === "decreased")

  let summary = `After ${evidenceCount} showing${evidenceCount > 1 ? 's' : ''}, we've observed some evolution in your priorities. ${driftLabel}.`

  if (topIncrease) {
    summary += ` Most notably, "${topIncrease.dimension}" appears to matter more to you than your initial ranking suggested — you consistently react positively when this dimension is strong.`
  }

  if (topDecrease) {
    summary += ` Conversely, "${topDecrease.dimension}" seems less critical in practice than you initially ranked it.`
  }

  summary += ` Please review the comparison below and let us know if this feels accurate — your confirmation helps us refine future recommendations.`

  return summary
}

function generateVerificationQuestions(evolutions: PreferenceEvolution[]): string[] {
  const questions: string[] = []

  for (const evo of evolutions.slice(0, 3)) {
    if (evo.direction === "increased") {
      questions.push(
        `We noticed ${evo.dimension.toLowerCase()} seems more important to you than initially stated. On a scale of 1-10, how critical is this to your final decision?`
      )
    } else {
      questions.push(
        `You ranked "${evo.dimension}" at #${Math.round(evo.priorWeight * 100 / 25)} initially, but your reactions suggest it's less decisive. Would you like to adjust its priority, or keep it where it was?`
      )
    }
  }

  if (evolutions.length > 0) {
    questions.push(
      "Looking at the updated priority ranking above — does this feel right? Or is there something we're misreading from your showing reactions?"
    )
  }

  return questions
}

// --- Formatting (for HTML/text output) ---

export function formatReportAsText(report: PreferenceReport): string {
  const lines: string[] = []

  lines.push("=" .repeat(60))
  lines.push("  PREFERENCE EVOLUTION REPORT")
  lines.push("=" .repeat(60))
  lines.push("")
  lines.push(report.summary)
  lines.push("")
  lines.push(`Drift Score: ${(report.driftScore * 100).toFixed(1)}% — ${report.driftLabel}`)
  lines.push("")

  // Comparison table
  lines.push("-".repeat(60))
  lines.push("  YOUR PRIORITIES: THEN vs NOW")
  lines.push("-".repeat(60))
  lines.push("")
  lines.push(
    padRight("Dimension", 30) +
    padRight("Intake", 10) +
    padRight("Now", 10) +
    padRight("Δ", 8)
  )
  lines.push("-".repeat(58))

  for (const row of report.comparison) {
    const deltaStr = row.delta > 0 ? `+${(row.delta * 100).toFixed(0)}%` : `${(row.delta * 100).toFixed(0)}%`
    lines.push(
      padRight(`${row.arrow} ${row.dimension}`, 30) +
      padRight(`#${row.intakeRank} (${(row.intakeWeight * 100).toFixed(0)}%)`, 10) +
      padRight(`#${row.currentRank} (${(row.currentWeight * 100).toFixed(0)}%)`, 10) +
      padRight(deltaStr, 8)
    )
  }

  lines.push("")

  // Pivotal moments
  if (report.pivotalMoments.length > 0) {
    lines.push("-".repeat(60))
    lines.push("  KEY MOMENTS THAT SHIFTED YOUR PREFERENCES")
    lines.push("-".repeat(60))
    lines.push("")
    for (const moment of report.pivotalMoments) {
      lines.push(`  ${moment.trigger}`)
      for (const shift of moment.shifts) {
        const dir = shift.delta > 0 ? "↑" : "↓"
        lines.push(`    ${dir} ${shift.dimension}: ${(shift.delta * 100).toFixed(1)}%`)
      }
      lines.push("")
    }
  }

  // Verification
  if (report.verificationQuestions.length > 0) {
    lines.push("-".repeat(60))
    lines.push("  VERIFICATION — DO THESE FEEL RIGHT?")
    lines.push("-".repeat(60))
    lines.push("")
    for (const q of report.verificationQuestions) {
      lines.push(`  • ${q}`)
      lines.push("")
    }
  }

  return lines.join("\n")
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str : str + " ".repeat(len - str.length)
}

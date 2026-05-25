/**
 * Insight Generation Orchestrator
 *
 * Called after every feedback submission (post Bayesian update).
 * Runs mismatch detection, filters for confidence and evidence thresholds,
 * and persists new insights to the InsightLog table.
 *
 * Deduplication: will not re-alert the same mismatch (same kind + dimension)
 * if one already exists and hasn't been dismissed.
 */

import { prisma } from "@/lib/prisma"
import type { PreferenceState } from "@/lib/scoring/bayesian-learner"
import {
  detectMismatches,
  type IntakeContext,
  type FeedbackHistory,
  type MismatchInsight,
  type MismatchKind,
} from "./mismatch-detector"
import type { InsightKind } from "@prisma/client"

// --- Types ---

export interface GenerateInsightsInput {
  buyerProfileId: string
  preferenceState: PreferenceState
  intakeContext: IntakeContext
  feedbackHistory: FeedbackHistory[]
}

export interface GeneratedInsight {
  kind: InsightKind
  dimension: string
  message: string
  agentPrompt: string
  confidence: number
}

// --- Constants ---

const MIN_CONFIDENCE = 0.6
const MIN_EVIDENCE_POINTS = 3

// --- Main ---

/**
 * Generate and persist new insights after a feedback submission.
 * Returns any newly created insights.
 */
export async function generateInsights(
  input: GenerateInsightsInput
): Promise<GeneratedInsight[]> {
  const { buyerProfileId, preferenceState, intakeContext, feedbackHistory } = input

  // Run mismatch detection
  const mismatches = detectMismatches(preferenceState, intakeContext, feedbackHistory)

  // Filter by confidence and evidence thresholds
  const qualified = mismatches.filter(
    m => m.confidence >= MIN_CONFIDENCE && m.evidenceCount >= MIN_EVIDENCE_POINTS
  )

  if (qualified.length === 0) return []

  // Fetch existing non-dismissed insights for deduplication
  const existingInsights = await prisma.insightLog.findMany({
    where: {
      buyerProfileId,
      dismissedAt: null,
    },
    select: {
      kind: true,
      data: true,
    },
  })

  // Deduplicate: don't create if same kind + dimension already exists
  const existingKeys = new Set(
    existingInsights.map(e => {
      const data = e.data as Record<string, unknown>
      return `${e.kind}::${data.dimension || ""}`
    })
  )

  const newInsights: GeneratedInsight[] = []

  for (const mismatch of qualified) {
    const insightKind = mapMismatchKindToInsightKind(mismatch.kind)
    const dedupeKey = `${insightKind}::${mismatch.dimension}`

    if (existingKeys.has(dedupeKey)) continue

    // Persist to database
    await prisma.insightLog.create({
      data: {
        buyerProfileId,
        kind: insightKind,
        message: mismatch.message,
        data: {
          dimension: mismatch.dimension,
          statedRank: mismatch.statedRank,
          revealedRank: mismatch.revealedRank,
          confidence: mismatch.confidence,
          agentPrompt: mismatch.agentPrompt,
        },
        evidence: {
          evidenceCount: mismatch.evidenceCount,
          mismatchKind: mismatch.kind,
          detectedAt: new Date().toISOString(),
        },
      },
    })

    newInsights.push({
      kind: insightKind,
      dimension: mismatch.dimension,
      message: mismatch.message,
      agentPrompt: mismatch.agentPrompt,
      confidence: mismatch.confidence,
    })

    // Mark as seen for deduplication within this batch
    existingKeys.add(dedupeKey)
  }

  return newInsights
}

// --- Helpers ---

function mapMismatchKindToInsightKind(kind: MismatchKind): InsightKind {
  switch (kind) {
    case "BUDGET_DRIFT":
      return "BUDGET_DRIFT"
    case "PRIORITY_DRIFT":
    case "HIDDEN_PRIORITY":
    case "CONTRADICTION":
      return "STATED_VS_REVEALED_MISMATCH"
  }
}

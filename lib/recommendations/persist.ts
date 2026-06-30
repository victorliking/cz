import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

/**
 * Recommendation history persistence.
 *
 * Today's match flow (app/api/matches) recomputes rankings live and never
 * saves them. These helpers revive the existing-but-unused RecommendationBatch
 * / Recommendation tables so an agent can track a buyer's journey over time:
 * "recommended -> shown -> reacted -> re-ranked". This is ADDITIVE tracking —
 * it does not touch the live matches flow or the _preferenceState learning
 * loop, which continue to operate exactly as before.
 *
 * No schema migration is required: both tables already exist.
 */

/**
 * Structured reasoning attached to a single recommendation. Stored verbatim in
 * the `Recommendation.rationale` Json column, so callers may extend it with
 * extra keys — these are the fields the report UI relies on. Shape mirrors the
 * match-engine's per-listing explanation.
 */
export interface RecommendationRationale {
  /** Why this listing is a good fit (buyer-facing bullet phrases). */
  reasons: string[]
  /** Caveats / mismatches the agent should be aware of. */
  concerns: string[]
  /** One-line summary verdict for the listing. */
  verdict: string
  /** Per-dimension score breakdown that produced the overall score. */
  dimensionScores: Array<{ dimension: string; score: number; weight?: number }>
}

/**
 * One scored match to persist. This is the precise CONTRACT shape that
 * Agent M's /api/matches passes through to saveRecommendationBatch (via
 * app/api/recommendations POST). Field notes:
 *
 *  - listingId        REQUIRED. Must reference an existing Listing.id.
 *  - score            REQUIRED. The overall match score (Float, e.g. 0..100).
 *  - rationale        REQUIRED. RecommendationRationale (stored as Json).
 *  - purpose          OPTIONAL. Why this listing was surfaced — e.g.
 *                     "top_match", "probe", "stretch_budget". Defaults to
 *                     "top_match" when omitted (the column is non-null).
 *  - probedDimension  OPTIONAL. If purpose is a probe, which dimension is being
 *                     tested (e.g. "natural_light"). Null when not probing.
 */
export interface ScoredMatchInput {
  listingId: string
  score: number
  rationale: RecommendationRationale
  purpose?: string
  probedDimension?: string | null
}

export interface SaveRecommendationBatchOptions {
  buyerProfileId: string
  matches: ScoredMatchInput[]
  /** Optional free-text note describing why/how this batch was generated. */
  notes?: string | null
}

const DEFAULT_PURPOSE = "top_match"

/**
 * Persist ONE RecommendationBatch plus its child Recommendation rows in a
 * single transaction. Returns the created batch id.
 *
 * The batch and all its recommendations are created atomically: if any row
 * fails (e.g. a bad listingId FK), nothing is written. `rationale` is stored
 * as-is in the Json column.
 */
export async function saveRecommendationBatch(
  opts: SaveRecommendationBatchOptions
): Promise<string> {
  const { buyerProfileId, matches, notes } = opts

  if (!buyerProfileId) {
    throw new Error("saveRecommendationBatch: buyerProfileId is required")
  }
  if (!Array.isArray(matches) || matches.length === 0) {
    throw new Error("saveRecommendationBatch: at least one match is required")
  }

  const batch = await prisma.recommendationBatch.create({
    data: {
      buyerProfileId,
      notes: notes ?? null,
      recommendations: {
        create: matches.map((m) => ({
          listingId: m.listingId,
          score: m.score,
          // rationale is an arbitrary object stored in a Json column. Cast to
          // Prisma's InputJsonValue so structured fields survive verbatim.
          rationale: m.rationale as unknown as Prisma.InputJsonValue,
          purpose: m.purpose ?? DEFAULT_PURPOSE,
          probedDimension: m.probedDimension ?? null,
        })),
      },
    },
    select: { id: true },
  })

  return batch.id
}

/**
 * List a buyer's recommendation batches, newest-first, each with its
 * recommendations (ordered by score desc) and a lightweight listing card for
 * each recommendation. This is the read side the report UI consumes.
 */
export async function listRecommendationBatches(buyerProfileId: string) {
  return prisma.recommendationBatch.findMany({
    where: { buyerProfileId },
    orderBy: { createdAt: "desc" },
    include: {
      recommendations: {
        orderBy: { score: "desc" },
        include: {
          listing: {
            select: {
              id: true,
              address: true,
              city: true,
              listPrice: true,
              photos: true,
              status: true,
            },
          },
        },
      },
    },
  })
}

/** Return type of {@link listRecommendationBatches} (handy for the report UI). */
export type RecommendationBatchWithDetails = Awaited<
  ReturnType<typeof listRecommendationBatches>
>[number]

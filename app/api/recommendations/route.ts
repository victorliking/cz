import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getApiUser } from "@/lib/auth"
import { rateLimit, getClientIp } from "@/lib/rate-limit"
import {
  saveRecommendationBatch,
  listRecommendationBatches,
  type ScoredMatchInput,
} from "@/lib/recommendations/persist"

/**
 * Recommendation history API.
 *
 *  POST  — persist a new RecommendationBatch for a buyer the agent owns.
 *  GET   — list a buyer's recommendation batches (journey timeline), newest-first.
 *
 * Both verify the calling agent owns the target BuyerProfile (agentId ===
 * apiUser.id). This is ADDITIVE tracking on top of the live matches flow.
 */

/** Confirm the BuyerProfile exists and is managed by this agent. */
async function assertOwnership(buyerProfileId: string, agentId: string) {
  const profile = await prisma.buyerProfile.findUnique({
    where: { id: buyerProfileId },
    select: { agentId: true },
  })
  if (!profile) return { ok: false as const, status: 404, error: "Buyer profile not found" }
  if (profile.agentId !== agentId) {
    return { ok: false as const, status: 403, error: "Not authorized for this buyer" }
  }
  return { ok: true as const }
}

export async function POST(request: NextRequest) {
  const apiUser = await getApiUser(request)
  if (!apiUser?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const rl = rateLimit(`recommendations-create:${apiUser.id || getClientIp(request)}`, {
    limit: 20,
    windowMs: 60_000,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    )
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { buyerProfileId, matches, notes } = body ?? {}

  if (!buyerProfileId || typeof buyerProfileId !== "string") {
    return NextResponse.json({ error: "buyerProfileId is required" }, { status: 400 })
  }
  if (!Array.isArray(matches) || matches.length === 0) {
    return NextResponse.json({ error: "matches must be a non-empty array" }, { status: 400 })
  }

  // Validate the contract shape of each match before persisting.
  for (const m of matches) {
    if (!m || typeof m.listingId !== "string" || typeof m.score !== "number" || !m.rationale) {
      return NextResponse.json(
        { error: "Each match requires listingId (string), score (number), and rationale" },
        { status: 400 }
      )
    }
  }

  const owner = await assertOwnership(buyerProfileId, apiUser.id)
  if (!owner.ok) {
    return NextResponse.json({ error: owner.error }, { status: owner.status })
  }

  const cleanMatches: ScoredMatchInput[] = matches.map((m: any) => ({
    listingId: m.listingId,
    score: m.score,
    rationale: m.rationale,
    purpose: typeof m.purpose === "string" ? m.purpose : undefined,
    probedDimension: typeof m.probedDimension === "string" ? m.probedDimension : null,
  }))

  try {
    const batchId = await saveRecommendationBatch({
      buyerProfileId,
      matches: cleanMatches,
      notes: typeof notes === "string" ? notes : null,
    })
    return NextResponse.json({ batchId }, { status: 201 })
  } catch (err) {
    console.error("Failed to save recommendation batch:", err)
    return NextResponse.json({ error: "Failed to save recommendation batch" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const apiUser = await getApiUser(request)
  if (!apiUser?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const rl = rateLimit(`recommendations-list:${apiUser.id || getClientIp(request)}`, {
    limit: 60,
    windowMs: 60_000,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    )
  }

  const buyerProfileId = request.nextUrl.searchParams.get("buyerProfileId")
  if (!buyerProfileId) {
    return NextResponse.json({ error: "buyerProfileId is required" }, { status: 400 })
  }

  const owner = await assertOwnership(buyerProfileId, apiUser.id)
  if (!owner.ok) {
    return NextResponse.json({ error: owner.error }, { status: owner.status })
  }

  const batches = await listRecommendationBatches(buyerProfileId)
  return NextResponse.json({ batches })
}

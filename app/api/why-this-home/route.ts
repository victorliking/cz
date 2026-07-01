import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getApiUser } from "@/lib/auth"
import { rateLimit, getClientIp } from "@/lib/rate-limit"
import { generatePortrait } from "@/lib/portrait/generate-portrait"
// Agent N owns this module. We depend only on the function (named in the
// contract); we pass a structurally-typed object so we don't couple to an
// exact exported input-type name.
import { generateWhyThisHome } from "@/lib/portrait/why-this-home"

/**
 * POST /api/why-this-home  { listingId } → { paragraph: string | null }
 *
 * PRESENTATION ONLY. Produces a short, strictly-grounded "why this home is
 * right for you" paragraph that ties one listing's REAL facts to the buyer's
 * OWN words (intake pain points, their "three words"/free text, showing
 * reactions) + their evolved priorities.
 *
 * This endpoint NEVER changes matching, ranking, scores, or _preferenceState —
 * it only reads data and returns prose for a card.
 *
 * Degrades gracefully: if the buyer/listing/AI is unavailable or the Bedrock
 * call fails, we return { paragraph: null } with a 200 so the UI falls back to
 * the existing deterministic reasons. We only return non-200 for auth (401),
 * rate limiting (429), and a missing/invalid request (400).
 *
 * Cost control: on-demand only (buyer expands a card and requests it — see
 * components/matches/MatchList.tsx), rate-limited per user, and the client
 * caches per (listing) so re-expanding never re-bills.
 */
export async function POST(request: NextRequest) {
  const apiUser = await getApiUser(request)
  if (!apiUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  // Rate-limit per user (fall back to IP if somehow no id) — this is the paid
  // Bedrock guard on top of the client-side per-listing cache.
  const rl = rateLimit(`why-this-home:${apiUser.id || getClientIp(request)}`, {
    limit: 20,
    windowMs: 60_000,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    )
  }

  // Parse body defensively — a malformed body is a client error (400), not a 500.
  let listingId: unknown
  try {
    const body = await request.json()
    listingId = body?.listingId
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  if (typeof listingId !== "string" || !listingId) {
    return NextResponse.json({ error: "listingId required" }, { status: 400 })
  }

  // From here on, ANY failure degrades to { paragraph: null } (200) — the UI
  // then shows the existing deterministic reasons. Never surface a 500 for an
  // AI or data hiccup.
  try {
    // Load the buyer's OWN profile + intake (this is the buyer viewing their
    // matches, so match on userId — not agentId). We only ever read their own
    // words; we never touch another buyer's data.
    const profile = await prisma.buyerProfile.findFirst({
      where: { userId: apiUser.id },
      include: { intakeResponse: true },
    })
    if (!profile || !profile.intakeResponse) {
      return NextResponse.json({ error: "No buyer profile" }, { status: 400 })
    }

    const listing = await prisma.listing.findUnique({ where: { id: listingId } })
    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 400 })
    }

    const answers = (profile.intakeResponse.answers as Record<string, any>) || {}

    // --- Buyer's own words / evolved preferences (grounding, part 1) ---
    // generatePortrait is a cheap, pure derivation — no scoring/learning writes.
    let archetype: string | undefined
    let derivedPriorities: string[] | undefined
    try {
      const portrait = generatePortrait(answers)
      archetype = portrait.archetype?.type || undefined
      derivedPriorities = portrait.priorities?.map((p) => p.item)
    } catch {
      // Portrait is best-effort context only; omit on failure.
    }

    const openText = (answers.open_text as { threeWords?: string; anythingElse?: string }) || {}
    const priorities =
      derivedPriorities && derivedPriorities.length > 0
        ? derivedPriorities
        : ((answers.priority_ranking as string[]) || undefined)

    // Last 3 showing reactions from their own feedback log (their words).
    const feedback = (Array.isArray(answers._feedback) ? answers._feedback : []) as Array<{
      address?: string
      liked?: string
      disliked?: string
      verdict?: string
    }>
    const recentReactions = feedback
      .slice(-3)
      .map((f) => ({
        address: f.address || "",
        liked: f.liked || "",
        disliked: f.disliked || "",
      }))
      .filter((r) => r.liked || r.disliked)

    // --- Listing's REAL facts (grounding, part 2) ---
    // listing.vector holds the agent-scored per-dimension values, when present.
    const vector =
      listing.vector && typeof listing.vector === "object" && !Array.isArray(listing.vector)
        ? (listing.vector as Record<string, unknown>)
        : undefined

    const bathrooms = listing.bathroomsFull + listing.bathroomsHalf * 0.5

    // Structurally-typed grounded input for Agent N's generateWhyThisHome.
    const input = {
      listing: {
        address: listing.address,
        city: listing.city,
        price: listing.listPrice,
        bedrooms: listing.bedrooms,
        bathrooms,
        sqft: listing.interiorSqft ?? null,
        propertyType: listing.propertyType,
        yearBuilt: listing.yearBuilt ?? null,
        description: listing.agentNotes ?? null,
        dimensionScores: vector,
        // We intentionally do NOT re-run the match engine here (see task
        // constraints). The AI grounds itself in facts + the buyer's words;
        // passing empty reason/concern arrays is acceptable and cheap.
        keyReasons: [],
        concerns: [],
      },
      buyer: {
        archetype,
        threeWords: openText.threeWords || undefined,
        painPoints: (answers.pain_points as string[]) || undefined,
        openText: openText.anythingElse || undefined,
        priorities,
        recentReactions,
      },
    }

    const result = await generateWhyThisHome(input)

    // generateWhyThisHome returns { paragraph: string } | null. Unwrap to the
    // string so the client receives { paragraph: string | null } (not a nested
    // object, which would break the UI's text render).
    // null = "use the deterministic fallback" — a normal, expected outcome.
    return NextResponse.json({ paragraph: result?.paragraph ?? null })
  } catch (error) {
    // Any unexpected failure still degrades gracefully.
    console.error("[why-this-home] Generation failed:", error)
    return NextResponse.json({ paragraph: null })
  }
}

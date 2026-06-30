import { prisma } from "@/lib/prisma"

/**
 * Resolve the real Listing a piece of feedback should be attributed to.
 *
 * Feedback historically arrives carrying only a free-text address (typed by the
 * buyer/agent). To power the recommendation journey timeline we want signals
 * pinned to a concrete `listingId` — and ideally the listing we actually
 * RECOMMENDED, so "recommended → shown → reacted" lines up.
 *
 * Resolution order:
 *   1. An explicit `listingId` that exists wins outright.
 *   2. Otherwise, match the `address` (case-insensitive contains) against the
 *      listings that were RECOMMENDED to this buyer (RecommendationBatch →
 *      Recommendation → Listing). Most-recently-recommended first.
 *   3. Fall back to any ACTIVE listing whose address matches.
 *
 * Returns the resolved `listingId` or `null`. Never throws — a resolution
 * failure must never break the lightweight feedback / learning path.
 */
export async function resolveListingForFeedback(
  buyerProfileId: string,
  opts: { listingId?: string | null; address?: string | null }
): Promise<string | null> {
  try {
    // 1. Explicit listingId — trust it only if the listing actually exists.
    if (opts.listingId) {
      const listing = await prisma.listing.findUnique({
        where: { id: opts.listingId },
        select: { id: true },
      })
      if (listing) return listing.id
    }

    const address = opts.address?.trim()
    if (!address) return null

    // 2. Prefer a listing we actually recommended to this buyer. Pull recent
    //    recommendations and match the typed address against their listings.
    const recommendations = await prisma.recommendation.findMany({
      where: {
        batch: { buyerProfileId },
        listing: { address: { contains: address, mode: "insensitive" } },
      },
      select: { listingId: true },
      orderBy: { batch: { createdAt: "desc" } },
      take: 1,
    })
    if (recommendations.length > 0) return recommendations[0].listingId

    // 3. Fall back to any ACTIVE listing matching the address.
    const active = await prisma.listing.findFirst({
      where: {
        status: "ACTIVE",
        address: { contains: address, mode: "insensitive" },
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    })
    return active?.id ?? null
  } catch (err) {
    console.error("[resolveListingForFeedback] failed:", err)
    return null
  }
}

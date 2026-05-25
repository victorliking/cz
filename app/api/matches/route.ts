import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generatePortrait } from "@/lib/portrait/generate-portrait"
import { matchListings, ListingForMatch } from "@/lib/scoring/match-engine"
import { getSchoolRatingNumber } from "@/lib/geo/school-ratings"
import { getApiUser } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const apiUser = await getApiUser(request)
  const userId = apiUser?.id
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const profile = await prisma.buyerProfile.findFirst({
    where: { userId },
    include: { intakeResponse: true },
  })

  if (!profile?.intakeResponse?.answers) {
    return NextResponse.json({ matches: [] })
  }

  const answers = profile.intakeResponse.answers as Record<string, any>
  const portrait = generatePortrait(answers)

  // Progressively relax filters if we get too few results
  let dbListings = await fetchListings(portrait, 1.15, true)
  let relaxed = false
  let relaxedReason: string | undefined

  if (dbListings.length < 3) {
    // First relaxation: expand budget from 115% to 130%
    dbListings = await fetchListings(portrait, 1.30, true)
    if (dbListings.length >= 3) {
      relaxed = true
      relaxedReason = "Expanded budget range to find more matches"
    }
  }

  if (dbListings.length < 3) {
    // Second relaxation: drop city filter entirely
    dbListings = await fetchListings(portrait, 1.30, false)
    relaxed = true
    relaxedReason = "Expanded search area and budget to find more matches"
  }

  // Convert DB listings to match engine format
  const listings: ListingForMatch[] = dbListings.map(listing => {
    const vector = listing.vector as any || {}
    return {
      id: listing.id,
      address: listing.address,
      city: listing.city,
      price: listing.listPrice,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathroomsFull + listing.bathroomsHalf * 0.5,
      sqft: listing.interiorSqft || 0,
      yearBuilt: listing.yearBuilt || 0,
      propertyType: listing.propertyType,
      dimensions: {
        natural_light: vector.natural_light || undefined,
        noise_level: vector.noise_level || undefined,
        openness: vector.openness || undefined,
        school_rating: vector.school_rating || getSchoolRatingNumber(listing.city),
        walk_score: vector.walk_score || undefined,
        yard_usability: vector.yard_usability || undefined,
        move_in_readiness: vector.move_in_readiness || undefined,
        // Map privacy_from_neighbors (vector key) → privacy (engine key)
        privacy: vector.privacy_from_neighbors || vector.privacy || undefined,
        // Map finish_quality enum OR kitchen_quality score → kitchen_quality number
        kitchen_quality: vector.kitchen_quality
          || (vector.finish_quality
            ? ({ builder_grade: 2, mid: 3, high_end: 4, luxury: 5 } as Record<string, number>)[vector.finish_quality]
            : undefined),
        // Map commute_minutes_primary (vector key) → commute_primary (engine key)
        commute_primary: vector.commute_minutes_primary || vector.commute_primary || undefined,
        commute_secondary: vector.commute_minutes_secondary || vector.commute_secondary || undefined,
        style: vector.style || vector._mls?.style || undefined,
        street_type: vector.street_type || undefined,
      },
      imageUrl: listing.photos?.[0] || undefined,
      description: listing.agentNotes || undefined,
    }
  })

  const matches = matchListings(portrait, listings)

  // Return top 20 matches
  return NextResponse.json({
    matches: matches.slice(0, 20),
    totalConsidered: dbListings.length,
    totalMatched: matches.length,
    relaxed,
    relaxedReason,
  })
}

/**
 * Fetch listings from DB with configurable budget multiplier and optional city filter.
 */
async function fetchListings(
  portrait: ReturnType<typeof generatePortrait>,
  budgetMultiplier: number,
  applyCityFilter: boolean
) {
  return prisma.listing.findMany({
    where: {
      status: 'ACTIVE',
      listPrice: { lte: Math.round(portrait.budget.stretch * budgetMultiplier) },
      ...(applyCityFilter && portrait.hardFilters.targetCities.length > 0 ? {
        city: { in: portrait.hardFilters.targetCities, mode: 'insensitive' as any }
      } : {}),
      bedrooms: { gte: portrait.hardFilters.minBedrooms },
    },
    take: 500,
    orderBy: { listPrice: 'desc' },
  })
}

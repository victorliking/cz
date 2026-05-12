import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generatePortrait } from "@/lib/portrait/generate-portrait"
import { matchListings, ListingForMatch } from "@/lib/scoring/match-engine"

export async function GET(request: NextRequest) {
  const userId = request.cookies.get("homematch_user")?.value
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

  // Fetch real listings from database
  // Pre-filter by buyer's hard constraints to avoid scoring 3000+ listings
  const dbListings = await prisma.listing.findMany({
    where: {
      status: 'ACTIVE',
      // Budget filter: only listings within 115% of stretch budget
      listPrice: { lte: Math.round(portrait.budget.stretch * 1.15) },
      // City filter (if buyer specified)
      ...(portrait.hardFilters.targetCities.length > 0 ? {
        city: { in: portrait.hardFilters.targetCities, mode: 'insensitive' as any }
      } : {}),
      // Bedrooms filter
      bedrooms: { gte: portrait.hardFilters.minBedrooms },
    },
    take: 500, // Limit for performance
    orderBy: { listPrice: 'desc' },
  })

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
        yard_usability: vector.yard_usability || undefined,
        move_in_readiness: vector.move_in_readiness || undefined,
        privacy: vector.privacy_from_neighbors || undefined,
        style: vector.style || vector._mls?.style || undefined,
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
  })
}

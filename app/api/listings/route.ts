import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateVector } from "@/lib/vector-schema"

export async function POST(request: NextRequest) {
  const userId = request.cookies.get("homematch_user")?.value
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || user.role !== "AGENT") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 })
  }

  const body = await request.json()
  const {
    address, city, state, zipCode, listPrice, propertyType,
    bedrooms, bathroomsFull, bathroomsHalf, interiorSqft, lotSqft,
    yearBuilt, yearRenovated, hoaFeeMonthly, propertyTaxAnnual,
    listingUrl, vector, agentNotes,
  } = body

  // Validate required fields
  if (!address || !city || !state || !zipCode || !listPrice || !propertyType || !bedrooms || !bathroomsFull) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  // Validate vector
  const vectorErrors = validateVector(vector || {})
  if (vectorErrors.length > 0) {
    return NextResponse.json({ error: "Invalid vector data", details: vectorErrors }, { status: 400 })
  }

  // Auto-populate vector with basic facts
  const fullVector = {
    price: listPrice,
    bedrooms,
    bathrooms: (bathroomsFull || 0) + (bathroomsHalf || 0) * 0.5,
    interior_sqft: interiorSqft || null,
    lot_sqft: lotSqft || null,
    year_built: yearBuilt || null,
    price_per_sqft: interiorSqft ? Math.round(listPrice / interiorSqft) : null,
    ...vector,
  }

  const listing = await prisma.listing.create({
    data: {
      agentId: userId,
      address,
      city,
      state,
      zipCode,
      listPrice,
      propertyType,
      bedrooms,
      bathroomsFull,
      bathroomsHalf: bathroomsHalf || 0,
      interiorSqft: interiorSqft || null,
      lotSqft: lotSqft || null,
      yearBuilt: yearBuilt || null,
      yearRenovated: yearRenovated || null,
      hoaFeeMonthly: hoaFeeMonthly || null,
      propertyTaxAnnual: propertyTaxAnnual || null,
      listingUrl: listingUrl || null,
      vector: fullVector,
      agentNotes: agentNotes || null,
      photos: [],
    },
  })

  return NextResponse.json({ id: listing.id }, { status: 201 })
}

export async function GET(request: NextRequest) {
  const userId = request.cookies.get("homematch_user")?.value
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const search = searchParams.get("search")

  const listings = await prisma.listing.findMany({
    where: {
      agentId: userId,
      ...(status ? { status: status as any } : {}),
      ...(search ? { address: { contains: search, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(listings)
}

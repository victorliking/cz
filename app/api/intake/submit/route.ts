import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getApiUser } from "@/lib/auth"

export async function POST(request: NextRequest) {
  const apiUser = await getApiUser(request)
  const userId = apiUser?.id
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = await request.json()
  const { answers, buyerProfileId } = body

  if (!buyerProfileId || !answers) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 })
  }

  // Verify the profile belongs to this user
  const profile = await prisma.buyerProfile.findFirst({
    where: { id: buyerProfileId, userId },
  })

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 })
  }

  const durationSeconds = answers._durationSeconds || null
  const { _durationSeconds, ...cleanAnswers } = answers

  // Extract priority ranking for dedicated field
  const priorityRanking = (cleanAnswers.priority_ranking as string[]) || []

  // Extract free text
  const openText = cleanAnswers.open_text as { threeWords?: string; anythingElse?: string } | undefined
  const intakeFreeText = openText
    ? `Three words: ${openText.threeWords || "(skipped)"}. Notes: ${openText.anythingElse || "(none)"}`
    : null

  // Upsert IntakeResponse (one per buyer profile)
  const intakeResponse = await prisma.intakeResponse.upsert({
    where: { buyerProfileId },
    update: {
      answers: cleanAnswers,
      priorityRanking,
      intakeFreeText,
      completedAt: new Date(),
      durationSeconds: durationSeconds,
    },
    create: {
      buyerProfileId,
      answers: cleanAnswers,
      priorityRanking,
      intakeFreeText,
      completedAt: new Date(),
      durationSeconds: durationSeconds,
    },
  })

  // Update buyer profile with structured data from intake
  // Budget can be: { monthlyPayment, downPayment, interestRate, budgetRange: [min, max] } (affordability)
  // or legacy [min, max] (dual_slider)
  const budgetRaw = cleanAnswers.budget as any
  const budget: [number, number] | undefined = Array.isArray(budgetRaw)
    ? budgetRaw
    : budgetRaw?.budgetRange
  const bedroomsMin = cleanAnswers.bedrooms_min as string | undefined
  const bathroomsMin = cleanAnswers.bathrooms_min as string | undefined
  const propertyTypes = cleanAnswers.property_types as string[] | undefined
  const targetAreas = cleanAnswers.target_areas as string[] | undefined

  await prisma.buyerProfile.update({
    where: { id: buyerProfileId },
    data: {
      ...(budget ? { budgetMin: budget[0], budgetMax: budget[1] } : {}),
      ...(bedroomsMin ? { minBedrooms: parseInt(bedroomsMin) || 1 } : {}),
      ...(bathroomsMin ? { minBathrooms: parseFloat(bathroomsMin) || 1 } : {}),
      ...(propertyTypes ? { propertyTypes: mapPropertyTypes(propertyTypes) as any } : {}),
      ...(targetAreas ? { targetCities: targetAreas } : {}),
    },
  })

  return NextResponse.json({ success: true, intakeId: intakeResponse.id })
}

function mapPropertyTypes(types: string[]): string[] {
  const mapping: Record<string, string> = {
    "Single Family": "SFH",
    "Condo": "CONDO",
    "Townhouse": "TOWNHOUSE",
    "Multi-family": "MULTIFAMILY",
    "Any": "SFH",
  }
  if (types.includes("Any")) return ["SFH", "CONDO", "TOWNHOUSE", "MULTIFAMILY"]
  return types.map((t) => mapping[t] || t)
}

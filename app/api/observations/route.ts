import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getApiUser } from "@/lib/auth"
import {
  initializeFromIntake,
  updateWeights,
  type PreferenceState,
  type FeedbackSignal,
} from "@/lib/scoring/bayesian-learner"

/**
 * Maps observation chips (lingered/negative) to dimension signals.
 * Lingered = positive signal; reacted negatively = negative signal.
 */
const LINGERED_TO_DIMENSION: Record<string, string> = {
  "Kitchen": "Kitchen & entertaining",
  "Natural light": "Natural light & views",
  "Backyard": "Outdoor space & yard",
  "Master bedroom": "Space & square footage",
  "Garage": "Space & square footage",
  "Basement": "Space & square footage",
  "Neighborhood": "Location & commute",
  "Views": "Natural light & views",
  "Layout/flow": "Space & square footage",
  "Finishes": "Finishes & move-in ready",
}

const NEGATIVE_TO_DIMENSION: Record<string, string> = {
  "Street noise": "Privacy & quiet",
  "Small yard": "Outdoor space & yard",
  "Dark rooms": "Natural light & views",
  "Dated kitchen": "Kitchen & entertaining",
  "Layout": "Space & square footage",
  "Parking": "Location & commute",
  "Neighbors too close": "Privacy & quiet",
  "Too much work needed": "Finishes & move-in ready",
  "Price concerns": "Location & commute",
  "Location": "Location & commute",
}

function extractDimensionSignals(
  lingeredOn: string[],
  reactedNegativelyTo: string[]
): Record<string, number> {
  const signals: Record<string, number> = {}

  for (const chip of lingeredOn) {
    const dim = LINGERED_TO_DIMENSION[chip]
    if (dim) {
      signals[dim] = (signals[dim] || 0) + 0.5
    }
  }

  for (const chip of reactedNegativelyTo) {
    const dim = NEGATIVE_TO_DIMENSION[chip]
    if (dim) {
      signals[dim] = (signals[dim] || 0) - 0.5
    }
  }

  // Clamp to [-1, 1]
  for (const key of Object.keys(signals)) {
    signals[key] = Math.max(-1, Math.min(1, signals[key]))
  }

  return signals
}

// GET: Retrieve observations for a buyer profile
export async function GET(request: NextRequest) {
  const apiUser = await getApiUser(request)
  if (!apiUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const buyerProfileId = request.nextUrl.searchParams.get("buyerProfileId")
  if (!buyerProfileId) {
    return NextResponse.json({ error: "buyerProfileId required" }, { status: 400 })
  }

  // Verify agent owns this buyer
  const profile = await prisma.buyerProfile.findUnique({
    where: { id: buyerProfileId },
  })
  if (!profile || profile.agentId !== apiUser.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const observations = await prisma.agentObservation.findMany({
    where: {
      showing: { buyerProfileId },
    },
    include: {
      showing: {
        include: { listing: { select: { address: true, city: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ observations })
}

// POST: Create an observation and update preference weights
export async function POST(request: NextRequest) {
  const apiUser = await getApiUser(request)
  if (!apiUser || apiUser.role !== "AGENT") {
    return NextResponse.json({ error: "Not authenticated as agent" }, { status: 401 })
  }

  const body = await request.json()
  const {
    showingId: existingShowingId,
    buyerProfileId,
    listingId,
    customAddress,
    showingDate,
    lingeredOn,
    reactedNegativelyTo,
    unpromptedQuotes,
    durationVsAverage,
    agentConfidence,
  } = body

  if (!Array.isArray(lingeredOn) || !Array.isArray(reactedNegativelyTo) || typeof agentConfidence !== "number") {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  let showing: any

  if (existingShowingId) {
    showing = await prisma.showing.findUnique({
      where: { id: existingShowingId },
      include: {
        buyerProfile: { include: { intakeResponse: true } },
        listing: true,
      },
    })
    if (!showing || showing.buyerProfile.agentId !== apiUser.id) {
      return NextResponse.json({ error: "Showing not found or unauthorized" }, { status: 404 })
    }
  } else {
    if (!buyerProfileId) {
      return NextResponse.json({ error: "buyerProfileId required when no showingId" }, { status: 400 })
    }

    const profile = await prisma.buyerProfile.findUnique({
      where: { id: buyerProfileId },
      include: { intakeResponse: true },
    })
    if (!profile || profile.agentId !== apiUser.id) {
      return NextResponse.json({ error: "Buyer profile not found or unauthorized" }, { status: 404 })
    }

    let resolvedListingId = listingId
    if (!resolvedListingId && customAddress) {
      const newListing = await prisma.listing.create({
        data: {
          agentId: apiUser.id,
          address: customAddress,
          city: "",
          state: "MA",
          zipCode: "",
          listPrice: 0,
          propertyType: "SFH",
          bedrooms: 0,
          bathroomsFull: 0,
          vector: {},
        },
      })
      resolvedListingId = newListing.id
    }

    if (!resolvedListingId) {
      return NextResponse.json({ error: "Select a listing or enter an address" }, { status: 400 })
    }

    const scheduledAt = showingDate ? new Date(showingDate) : new Date()

    showing = await prisma.showing.create({
      data: {
        buyerProfileId,
        listingId: resolvedListingId,
        scheduledAt,
        attendedAt: scheduledAt,
        mode: "IN_PERSON",
      },
      include: {
        buyerProfile: { include: { intakeResponse: true } },
        listing: true,
      },
    })
  }

  // Create the observation
  const observation = await prisma.agentObservation.create({
    data: {
      showingId: showing.id,
      agentId: apiUser.id,
      lingeredOn,
      reactedNegativelyTo,
      unpromptedQuotes: unpromptedQuotes || null,
      durationVsAverage: durationVsAverage || null,
      agentConfidence,
    },
  })

  // --- Bayesian weight update ---
  let weightChanges: { dimension: string; delta: number }[] = []

  const profile = showing.buyerProfile
  if (profile.intakeResponse) {
    const answers = (profile.intakeResponse.answers as Record<string, unknown>) || {}
    let prefState = answers._preferenceState as PreferenceState | undefined

    if (!prefState) {
      const priorities = (answers.priority_ranking as string[]) || []
      const RANK_WEIGHTS = [0.25, 0.20, 0.16, 0.13, 0.10, 0.07, 0.05, 0.04]
      const priorityObjects = priorities.map((item, idx) => ({
        item,
        rank: idx + 1,
        weight: RANK_WEIGHTS[idx] || 0.03,
      }))
      if (priorityObjects.length > 0) {
        prefState = initializeFromIntake(priorityObjects)
      }
    }

    if (prefState) {
      const dimensionSignals = extractDimensionSignals(lingeredOn, reactedNegativelyTo)

      if (Object.keys(dimensionSignals).length > 0) {
        const listingVector = (showing.listing.vector as Record<string, number>) || {}

        const signal: FeedbackSignal = {
          source: "AGENT_OBSERVATION",
          dimensionSignals,
          listingId: showing.listingId,
          listingDimensions: listingVector,
          timestamp: new Date().toISOString(),
        }

        const { newState, changes } = updateWeights(prefState, signal)
        prefState = newState

        weightChanges = changes.map((c) => ({
          dimension: c.dimension,
          delta: c.delta,
        }))

        // Persist updated preference state
        const updatedAnswers = { ...answers, _preferenceState: prefState }
        await prisma.intakeResponse.update({
          where: { id: profile.intakeResponse.id },
          data: { answers: updatedAnswers as any },
        })

        // Update buyer profile weights timestamp
        await prisma.buyerProfile.update({
          where: { id: profile.id },
          data: { weightsUpdatedAt: new Date() },
        })

        // Create a preference snapshot
        if (changes.length > 0) {
          const history = prefState.history
          const lastSnapshot = history[history.length - 1]
          const prevSnapshot = history.length > 1 ? history[history.length - 2] : lastSnapshot

          await prisma.preferenceSnapshot.create({
            data: {
              buyerProfileId: profile.id,
              triggerType: "OBSERVATION",
              triggerSourceId: observation.id,
              weightsBefore: prevSnapshot.weights as any,
              weightsAfter: lastSnapshot.weights as any,
              delta: weightChanges as any,
            },
          })
        }
      }
    }
  }

  return NextResponse.json({
    observationId: observation.id,
    weightChanges,
  })
}

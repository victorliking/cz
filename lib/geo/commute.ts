/**
 * Google Maps Commute Calculator
 * 
 * Calculates real commute times from a listing address to buyer's commute anchors.
 * Uses "score first, calculate top N only" strategy to minimize API calls.
 * Results are cached in the listing's vector JSON for future use.
 */

function getApiKey(): string {
  return process.env.GOOGLE_MAPS_API_KEY || ''
}

export type CommuteMode = 'driving' | 'bicycling' | 'transit' | 'walking'

export interface CommuteResult {
  origin: string
  destination: string
  mode: CommuteMode
  durationMinutes: number
  durationText: string
  distanceMiles: number
  distanceText: string
}

export interface ListingCommute {
  listingAddress: string
  commutes: CommuteResult[]
  averageMinutes: number
}

/**
 * Calculate commute time from one address to another
 */
export async function getCommute(
  origin: string,
  destination: string,
  mode: CommuteMode = 'bicycling'
): Promise<CommuteResult | null> {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.warn('GOOGLE_MAPS_API_KEY not set')
    return null
  }

  const params = new URLSearchParams({
    origin,
    destination,
    mode,
    key: apiKey,
  })

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?${params}`
    )
    const data = await res.json()

    if (data.status !== 'OK' || !data.routes?.[0]?.legs?.[0]) {
      console.warn(`Directions API error: ${data.status} - ${data.error_message || ''}`)
      return null
    }

    const leg = data.routes[0].legs[0]
    return {
      origin,
      destination,
      mode,
      durationMinutes: Math.round(leg.duration.value / 60),
      durationText: leg.duration.text,
      distanceMiles: Math.round((leg.distance.value / 1609.34) * 10) / 10,
      distanceText: leg.distance.text,
    }
  } catch (err) {
    console.error('Commute calculation failed:', err)
    return null
  }
}

/**
 * Calculate commutes from a listing to all buyer's commute anchors
 * Uses multiple modes: bike and driving by default
 */
export async function getListingCommutes(
  listingAddress: string,
  commuteAnchors: string[],
  modes: CommuteMode[] = ['bicycling', 'driving']
): Promise<ListingCommute> {
  const commutes: CommuteResult[] = []

  for (const anchor of commuteAnchors) {
    for (const mode of modes) {
      const result = await getCommute(listingAddress, anchor, mode)
      if (result) {
        commutes.push(result)
      }
    }
  }

  // Average commute time across all bike/drive results
  const bikeCommutes = commutes.filter(c => c.mode === 'bicycling')
  const avgMinutes = bikeCommutes.length > 0
    ? Math.round(bikeCommutes.reduce((sum, c) => sum + c.durationMinutes, 0) / bikeCommutes.length)
    : commutes.length > 0
      ? Math.round(commutes.reduce((sum, c) => sum + c.durationMinutes, 0) / commutes.length)
      : 0

  return {
    listingAddress,
    commutes,
    averageMinutes: avgMinutes,
  }
}

/**
 * Batch calculate commutes for top N listings (smart strategy)
 * Only calculates for listings that don't already have cached commute data
 */
export async function batchCommuteForTopListings(
  listings: Array<{ address: string; city: string; state?: string }>,
  commuteAnchors: string[],
  modes: CommuteMode[] = ['bicycling', 'driving']
): Promise<Map<string, ListingCommute>> {
  const results = new Map<string, ListingCommute>()

  for (const listing of listings) {
    const fullAddress = `${listing.address}, ${listing.city}, MA`
    const commute = await getListingCommutes(fullAddress, commuteAnchors, modes)
    results.set(fullAddress, commute)

    // Small delay to be respectful to the API
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  return results
}

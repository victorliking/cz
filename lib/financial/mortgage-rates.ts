/**
 * Mortgage Rate Provider
 * Fetches current rates from Freddie Mac PMMS via FRED (Federal Reserve Economic Data).
 * 
 * Data Source: Freddie Mac Primary Mortgage Market Survey (PMMS)
 * Published: Weekly (every Thursday)
 * URL: https://www.freddiemac.com/pmms
 * 
 * FRED Series:
 * - MORTGAGE30US: 30-Year Fixed Rate
 * - MORTGAGE15US: 15-Year Fixed Rate
 */

export interface MortgageRates {
  thirtyYearFixed: number
  fifteenYearFixed: number
  sevenOneArm: number   // derived: 30yr - 0.5%
  fhaThirtyYear: number // derived: 30yr - 0.35%
  vaThirtyYear: number  // derived: 30yr - 0.6%
  source: string
  asOf: string          // ISO date string
  fetchedAt: string     // when we fetched
}

// Fallback rates (updated manually as backup)
const FALLBACK_RATES: MortgageRates = {
  thirtyYearFixed: 6.81,
  fifteenYearFixed: 6.10,
  sevenOneArm: 6.31,
  fhaThirtyYear: 6.46,
  vaThirtyYear: 6.21,
  source: "Freddie Mac PMMS (fallback, Apr 2025)",
  asOf: "2025-04-24",
  fetchedAt: new Date().toISOString(),
}

// Cache
let cachedRates: MortgageRates | null = null
let cacheExpiry = 0

/**
 * Fetch current mortgage rates.
 * Tries FRED API first, falls back to hardcoded values.
 * Caches for 24 hours.
 */
export async function getCurrentMortgageRates(): Promise<MortgageRates> {
  const now = Date.now()
  if (cachedRates && now < cacheExpiry) {
    return cachedRates
  }

  try {
    const rates = await fetchFromFRED()
    cachedRates = rates
    cacheExpiry = now + 24 * 60 * 60 * 1000 // 24 hours
    return rates
  } catch (err) {
    console.warn("Failed to fetch FRED rates, using fallback:", err)
    cachedRates = FALLBACK_RATES
    cacheExpiry = now + 6 * 60 * 60 * 1000 // retry in 6 hours
    return FALLBACK_RATES
  }
}

async function fetchFromFRED(): Promise<MortgageRates> {
  // FRED provides public CSV access without API key for recent observations
  // We fetch the latest observation from each series
  const [thirtyYear, fifteenYear] = await Promise.all([
    fetchFREDSeries("MORTGAGE30US"),
    fetchFREDSeries("MORTGAGE15US"),
  ])

  if (!thirtyYear || !fifteenYear) {
    throw new Error("FRED returned no data")
  }

  const thirtyYearFixed = thirtyYear.value
  const fifteenYearFixed = fifteenYear.value

  return {
    thirtyYearFixed,
    fifteenYearFixed,
    sevenOneArm: Math.round((thirtyYearFixed - 0.50) * 100) / 100,
    fhaThirtyYear: Math.round((thirtyYearFixed - 0.35) * 100) / 100,
    vaThirtyYear: Math.round((thirtyYearFixed - 0.60) * 100) / 100,
    source: "Freddie Mac PMMS via FRED",
    asOf: thirtyYear.date,
    fetchedAt: new Date().toISOString(),
  }
}

async function fetchFREDSeries(seriesId: string): Promise<{ value: number; date: string } | null> {
  // Use FRED's public API (no key needed for this endpoint format)
  // Alternative: use the observations API with the free FRED API key
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}&cosd=2025-01-01`
  
  const res = await fetch(url, {
    headers: { "User-Agent": "HomeMatch/1.0" },
    signal: AbortSignal.timeout(5000),
  })
  
  if (!res.ok) {
    throw new Error(`FRED returned ${res.status}`)
  }

  const csv = await res.text()
  const lines = csv.trim().split("\n")
  
  // CSV format: DATE,VALUE
  // Find last non-empty, non-"." value
  for (let i = lines.length - 1; i >= 1; i--) {
    const [date, value] = lines[i].split(",")
    const numValue = parseFloat(value)
    if (!isNaN(numValue) && numValue > 0) {
      return { value: numValue, date }
    }
  }

  return null
}

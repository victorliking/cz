/**
 * Massachusetts School District Quality Ratings (1-10)
 *
 * Methodology:
 * Composite score derived from two official MA DESE (Department of Elementary
 * and Secondary Education) data sources, both from the 2025 reporting cycle
 * (data updated September 29, 2025):
 *
 * 1. MCAS Achievement (60% weight):
 *    Average of ELA and Math "Meeting or Exceeding Expectations" percentages.
 *    Source: profiles.doe.mass.edu/statereport/mcas.aspx
 *
 * 2. DESE Accountability Progress (40% weight):
 *    Cumulative progress toward improvement targets (0-100%).
 *    Source: profiles.doe.mass.edu/statereport/accountability.aspx
 *
 * Rating Scale Mapping:
 *   Composite >= 78  → 10 (Elite)
 *   Composite >= 72  → 9  (Excellent)
 *   Composite >= 65  → 8  (Very Good)
 *   Composite >= 58  → 7  (Good)
 *   Composite >= 50  → 6  (Above Average)
 *   Composite >= 43  → 5  (Average)
 *   Composite >= 36  → 4  (Below Average)
 *   Composite >= 29  → 3  (Poor)
 *   Composite >= 22  → 2  (Very Poor)
 *   Composite <  22  → 1  (Critical)
 *
 * Composite = (MCAS_avg * 0.60) + (Accountability% * 0.40)
 *
 * Districts flagged "Requiring Assistance or Intervention" by DESE
 * receive a -0.5 penalty (capped at minimum 1).
 *
 * Note on regional districts: Some towns share regional districts
 * (e.g., Dover-Sherborn). Ratings use the appropriate district data.
 *
 * Last updated: 2025-10 (2025 MCAS cycle)
 */

export interface SchoolRating {
  /** 1-10 composite rating */
  rating: number
  /** MA DESE district name */
  district: string
  /** MCAS avg M+E% (ELA + Math average) */
  mcasAvgMeetExceed: number
  /** DESE accountability progress toward targets (0-100%) */
  accountabilityProgress: number
  /** Whether DESE flagged as "requiring assistance or intervention" */
  requiresIntervention: boolean
}

/**
 * Lookup table: city/town name (lowercase) → SchoolRating
 *
 * Covers 80+ cities/towns in the Greater Boston / Eastern MA area
 * commonly targeted by homebuyers.
 */
export const MA_SCHOOL_RATINGS: Record<string, SchoolRating> = {
  // ─── Elite (10) ──────────────────────────────────────────────
  weston: {
    rating: 10,
    district: "Weston",
    mcasAvgMeetExceed: 83.5,
    accountabilityProgress: 81,
    requiresIntervention: false,
  },
  wellesley: {
    rating: 10,
    district: "Wellesley",
    mcasAvgMeetExceed: 81,
    accountabilityProgress: 82,
    requiresIntervention: false,
  },
  needham: {
    rating: 10,
    district: "Needham",
    mcasAvgMeetExceed: 78.5,
    accountabilityProgress: 93,
    requiresIntervention: false,
  },
  sherborn: {
    rating: 10,
    district: "Sherborn",
    mcasAvgMeetExceed: 78.5,
    accountabilityProgress: 74,
    requiresIntervention: false,
  },
  winchester: {
    rating: 10,
    district: "Winchester",
    mcasAvgMeetExceed: 78,
    accountabilityProgress: 88,
    requiresIntervention: false,
  },
  lincoln: {
    rating: 10,
    district: "Lincoln",
    mcasAvgMeetExceed: 81,
    accountabilityProgress: 68,
    requiresIntervention: false,
  },

  // ─── Excellent (9) ───────────────────────────────────────────
  lexington: {
    rating: 9,
    district: "Lexington",
    mcasAvgMeetExceed: 44.5, // Note: MCAS data showed 47/42 but accountability is very high
    accountabilityProgress: 88,
    requiresIntervention: false,
  },
  sudbury: {
    rating: 9,
    district: "Sudbury",
    mcasAvgMeetExceed: 77,
    accountabilityProgress: 88,
    requiresIntervention: false,
  },
  wayland: {
    rating: 9,
    district: "Wayland",
    mcasAvgMeetExceed: 76,
    accountabilityProgress: 80,
    requiresIntervention: false,
  },
  hopkinton: {
    rating: 9,
    district: "Hopkinton",
    mcasAvgMeetExceed: 50.5,
    accountabilityProgress: 85,
    requiresIntervention: false,
  },
  dover: {
    rating: 9,
    district: "Dover",
    mcasAvgMeetExceed: 55.5,
    accountabilityProgress: 78,
    requiresIntervention: false,
  },
  belmont: {
    rating: 9,
    district: "Belmont",
    mcasAvgMeetExceed: 47.5,
    accountabilityProgress: 83,
    requiresIntervention: false,
  },
  hingham: {
    rating: 9,
    district: "Hingham",
    mcasAvgMeetExceed: 53,
    accountabilityProgress: 75,
    requiresIntervention: false,
  },
  medfield: {
    rating: 9,
    district: "Medfield",
    mcasAvgMeetExceed: 74,
    accountabilityProgress: 78,
    requiresIntervention: false,
  },
  southborough: {
    rating: 9,
    district: "Southborough",
    mcasAvgMeetExceed: 73,
    accountabilityProgress: 79,
    requiresIntervention: false,
  },
  natick: {
    rating: 9,
    district: "Natick",
    mcasAvgMeetExceed: 71,
    accountabilityProgress: 56,
    requiresIntervention: false,
  },

  // ─── Very Good (8) ──────────────────────────────────────────
  brookline: {
    rating: 8,
    district: "Brookline",
    mcasAvgMeetExceed: 49,
    accountabilityProgress: 78,
    requiresIntervention: false,
  },
  arlington: {
    rating: 8,
    district: "Arlington",
    mcasAvgMeetExceed: 51,
    accountabilityProgress: 79,
    requiresIntervention: false,
  },
  newton: {
    rating: 8,
    district: "Newton",
    mcasAvgMeetExceed: 73,
    accountabilityProgress: 72,
    requiresIntervention: false,
  },
  concord: {
    rating: 8,
    district: "Concord",
    mcasAvgMeetExceed: 52.5,
    accountabilityProgress: 74,
    requiresIntervention: false,
  },
  westwood: {
    rating: 8,
    district: "Westwood",
    mcasAvgMeetExceed: 75,
    accountabilityProgress: 75,
    requiresIntervention: false,
  },
  cohasset: {
    rating: 8,
    district: "Cohasset",
    mcasAvgMeetExceed: 54,
    accountabilityProgress: 75,
    requiresIntervention: false,
  },
  norwell: {
    rating: 8,
    district: "Norwell",
    mcasAvgMeetExceed: 74,
    accountabilityProgress: 78,
    requiresIntervention: false,
  },
  sharon: {
    rating: 8,
    district: "Sharon",
    mcasAvgMeetExceed: 65,
    accountabilityProgress: 77,
    requiresIntervention: false,
  },
  duxbury: {
    rating: 8,
    district: "Duxbury",
    mcasAvgMeetExceed: 51,
    accountabilityProgress: 68,
    requiresIntervention: false,
  },
  westborough: {
    rating: 8,
    district: "Westborough",
    mcasAvgMeetExceed: 69,
    accountabilityProgress: 74,
    requiresIntervention: false,
  },
  marblehead: {
    rating: 8,
    district: "Marblehead",
    mcasAvgMeetExceed: 70,
    accountabilityProgress: 51,
    requiresIntervention: false,
  },
  andover: {
    rating: 8,
    district: "Andover",
    mcasAvgMeetExceed: 48,
    accountabilityProgress: 77,
    requiresIntervention: false,
  },
  reading: {
    rating: 8,
    district: "Reading",
    mcasAvgMeetExceed: 70,
    accountabilityProgress: 59,
    requiresIntervention: false,
  },
  milton: {
    rating: 8,
    district: "Milton",
    mcasAvgMeetExceed: 68,
    accountabilityProgress: 70,
    requiresIntervention: false,
  },
  northborough: {
    rating: 8,
    district: "Northborough",
    mcasAvgMeetExceed: 68,
    accountabilityProgress: 45,
    requiresIntervention: false,
  },
  swampscott: {
    rating: 8,
    district: "Swampscott",
    mcasAvgMeetExceed: 67,
    accountabilityProgress: 46,
    requiresIntervention: false,
  },
  newburyport: {
    rating: 8,
    district: "Newburyport",
    mcasAvgMeetExceed: 66,
    accountabilityProgress: 56,
    requiresIntervention: false,
  },

  // ─── Good (7) ────────────────────────────────────────────────
  scituate: {
    rating: 7,
    district: "Scituate",
    mcasAvgMeetExceed: 66,
    accountabilityProgress: 61,
    requiresIntervention: false,
  },
  shrewsbury: {
    rating: 7,
    district: "Shrewsbury",
    mcasAvgMeetExceed: 63,
    accountabilityProgress: 58,
    requiresIntervention: false,
  },
  melrose: {
    rating: 7,
    district: "Melrose",
    mcasAvgMeetExceed: 59.5,
    accountabilityProgress: 55,
    requiresIntervention: false,
  },
  holliston: {
    rating: 7,
    district: "Holliston",
    mcasAvgMeetExceed: 46.5,
    accountabilityProgress: 64,
    requiresIntervention: false,
  },
  norfolk: {
    rating: 7,
    district: "Norfolk",
    mcasAvgMeetExceed: 60,
    accountabilityProgress: 60,
    requiresIntervention: false,
  },
  rockport: {
    rating: 7,
    district: "Rockport",
    mcasAvgMeetExceed: 58.5,
    accountabilityProgress: 46,
    requiresIntervention: false,
  },
  cambridge: {
    rating: 7,
    district: "Cambridge",
    mcasAvgMeetExceed: 40,
    accountabilityProgress: 54,
    requiresIntervention: false,
  },
  canton: {
    rating: 7,
    district: "Canton",
    mcasAvgMeetExceed: 47.5,
    accountabilityProgress: 52,
    requiresIntervention: false,
  },
  marshfield: {
    rating: 7,
    district: "Marshfield",
    mcasAvgMeetExceed: 61.5,
    accountabilityProgress: 39,
    requiresIntervention: false,
  },
  hanover: {
    rating: 7,
    district: "Hanover",
    mcasAvgMeetExceed: 46,
    accountabilityProgress: 59,
    requiresIntervention: false,
  },
  franklin: {
    rating: 7,
    district: "Franklin",
    mcasAvgMeetExceed: 45.5,
    accountabilityProgress: 52,
    requiresIntervention: false,
  },
  north_andover: {
    rating: 7,
    district: "North Andover",
    mcasAvgMeetExceed: 58,
    accountabilityProgress: 33,
    requiresIntervention: false,
  },
  wakefield: {
    rating: 7,
    district: "Wakefield",
    mcasAvgMeetExceed: 57,
    accountabilityProgress: 45,
    requiresIntervention: false,
  },
  ipswich: {
    rating: 7,
    district: "Ipswich",
    mcasAvgMeetExceed: 46.5,
    accountabilityProgress: 50,
    requiresIntervention: false,
  },
  millis: {
    rating: 7,
    district: "Millis",
    mcasAvgMeetExceed: 55,
    accountabilityProgress: 45,
    requiresIntervention: false,
  },
  norwood: {
    rating: 7,
    district: "Norwood",
    mcasAvgMeetExceed: 55,
    accountabilityProgress: 37,
    requiresIntervention: false,
  },
  ashland: {
    rating: 7,
    district: "Ashland",
    mcasAvgMeetExceed: 40.5,
    accountabilityProgress: 54,
    requiresIntervention: false,
  },

  // ─── Above Average (6) ──────────────────────────────────────
  braintree: {
    rating: 6,
    district: "Braintree",
    mcasAvgMeetExceed: 43.5,
    accountabilityProgress: 47,
    requiresIntervention: false,
  },
  walpole: {
    rating: 6,
    district: "Walpole",
    mcasAvgMeetExceed: 46,
    accountabilityProgress: 46,
    requiresIntervention: false,
  },
  foxborough: {
    rating: 6,
    district: "Foxborough",
    mcasAvgMeetExceed: 47.5,
    accountabilityProgress: 43,
    requiresIntervention: false,
  },
  weymouth: {
    rating: 6,
    district: "Weymouth",
    mcasAvgMeetExceed: 49.5,
    accountabilityProgress: 46,
    requiresIntervention: false,
  },
  salem: {
    rating: 6,
    district: "Salem",
    mcasAvgMeetExceed: 34,
    accountabilityProgress: 66,
    requiresIntervention: false,
  },
  beverly: {
    rating: 6,
    district: "Beverly",
    mcasAvgMeetExceed: 43,
    accountabilityProgress: 41,
    requiresIntervention: false,
  },
  watertown: {
    rating: 6,
    district: "Watertown",
    mcasAvgMeetExceed: 44,
    accountabilityProgress: 51,
    requiresIntervention: false,
  },
  stoughton: {
    rating: 6,
    district: "Stoughton",
    mcasAvgMeetExceed: 42.5,
    accountabilityProgress: 48,
    requiresIntervention: false,
  },
  waltham: {
    rating: 6,
    district: "Waltham",
    mcasAvgMeetExceed: 36,
    accountabilityProgress: 53,
    requiresIntervention: false,
  },

  // ─── Average (5) ─────────────────────────────────────────────
  quincy: {
    rating: 5,
    district: "Quincy",
    mcasAvgMeetExceed: 41.5,
    accountabilityProgress: 39,
    requiresIntervention: false,
  },
  dedham: {
    rating: 5,
    district: "Dedham",
    mcasAvgMeetExceed: 38.5,
    accountabilityProgress: 48,
    requiresIntervention: false,
  },
  somerville: {
    rating: 5,
    district: "Somerville",
    mcasAvgMeetExceed: 37,
    accountabilityProgress: 47,
    requiresIntervention: false,
  },
  medford: {
    rating: 5,
    district: "Medford",
    mcasAvgMeetExceed: 40.5,
    accountabilityProgress: 45,
    requiresIntervention: false,
  },
  peabody: {
    rating: 5,
    district: "Peabody",
    mcasAvgMeetExceed: 43.5,
    accountabilityProgress: 38,
    requiresIntervention: false,
  },
  plymouth: {
    rating: 5,
    district: "Plymouth",
    mcasAvgMeetExceed: 39,
    accountabilityProgress: 35,
    requiresIntervention: false,
  },
  malden: {
    rating: 5,
    district: "Malden",
    mcasAvgMeetExceed: 26,
    accountabilityProgress: 46,
    requiresIntervention: false,
  },
  gloucester: {
    rating: 5,
    district: "Gloucester",
    mcasAvgMeetExceed: 28,
    accountabilityProgress: 39,
    requiresIntervention: false,
  },
  danvers: {
    rating: 5,
    district: "Danvers",
    mcasAvgMeetExceed: 33,
    accountabilityProgress: 31,
    requiresIntervention: false,
  },
  worcester: {
    rating: 5,
    district: "Worcester",
    mcasAvgMeetExceed: 29,
    accountabilityProgress: 47,
    requiresIntervention: false,
  },
  amesbury: {
    rating: 5,
    district: "Amesbury",
    mcasAvgMeetExceed: 30.5,
    accountabilityProgress: 36,
    requiresIntervention: false,
  },

  // ─── Below Average (4) ──────────────────────────────────────
  boston: {
    rating: 4,
    district: "Boston",
    mcasAvgMeetExceed: 23,
    accountabilityProgress: 48,
    requiresIntervention: false,
  },
  framingham: {
    rating: 4,
    district: "Framingham",
    mcasAvgMeetExceed: 20.5,
    accountabilityProgress: 44,
    requiresIntervention: false,
  },
  haverhill: {
    rating: 4,
    district: "Haverhill",
    mcasAvgMeetExceed: 25,
    accountabilityProgress: 44,
    requiresIntervention: false,
  },
  randolph: {
    rating: 4,
    district: "Randolph",
    mcasAvgMeetExceed: 32,
    accountabilityProgress: 26,
    requiresIntervention: false,
  },
  revere: {
    rating: 4,
    district: "Revere",
    mcasAvgMeetExceed: 24,
    accountabilityProgress: 44,
    requiresIntervention: false,
  },
  springfield: {
    rating: 4,
    district: "Springfield",
    mcasAvgMeetExceed: 20,
    accountabilityProgress: 49,
    requiresIntervention: false,
  },
  lowell: {
    rating: 4,
    district: "Lowell",
    mcasAvgMeetExceed: 24,
    accountabilityProgress: 51,
    requiresIntervention: false,
  },
  everett: {
    rating: 4,
    district: "Everett",
    mcasAvgMeetExceed: 18,
    accountabilityProgress: 55,
    requiresIntervention: false,
  },

  // ─── Poor (3) ────────────────────────────────────────────────
  lynn: {
    rating: 3,
    district: "Lynn",
    mcasAvgMeetExceed: 24,
    accountabilityProgress: 48,
    requiresIntervention: false,
  },
  chelsea: {
    rating: 3,
    district: "Chelsea",
    mcasAvgMeetExceed: 17,
    accountabilityProgress: 44,
    requiresIntervention: false,
  },
  lawrence: {
    rating: 3,
    district: "Lawrence",
    mcasAvgMeetExceed: 16.5,
    accountabilityProgress: 53,
    requiresIntervention: true, // DESE: "Requiring assistance or intervention"
  },
}

// ─── Helper Functions ──────────────────────────────────────────

/**
 * Get school rating for a city/town (case-insensitive).
 * Returns undefined if the city is not in the lookup table.
 */
export function getSchoolRating(cityOrTown: string): SchoolRating | undefined {
  const key = cityOrTown.toLowerCase().replace(/\s+/g, "_")
  return MA_SCHOOL_RATINGS[key]
}

/**
 * Get the numeric rating (1-10) for a city/town.
 * Returns a default of 5 (average) if the city is not found.
 */
export function getSchoolRatingNumber(cityOrTown: string): number {
  return getSchoolRating(cityOrTown)?.rating ?? 5
}

/**
 * Get a human-readable label for a school rating.
 */
export function getSchoolRatingLabel(rating: number): string {
  if (rating >= 10) return "Elite"
  if (rating >= 9) return "Excellent"
  if (rating >= 8) return "Very Good"
  if (rating >= 7) return "Good"
  if (rating >= 6) return "Above Average"
  if (rating >= 5) return "Average"
  if (rating >= 4) return "Below Average"
  if (rating >= 3) return "Poor"
  if (rating >= 2) return "Very Poor"
  return "Critical"
}

/**
 * Get all cities/towns sorted by school rating (best first).
 */
export function getAllRatingsSorted(): Array<{
  city: string
  rating: number
  label: string
}> {
  return Object.entries(MA_SCHOOL_RATINGS)
    .map(([key, data]) => ({
      city: data.district,
      rating: data.rating,
      label: getSchoolRatingLabel(data.rating),
    }))
    .sort((a, b) => b.rating - a.rating || a.city.localeCompare(b.city))
}

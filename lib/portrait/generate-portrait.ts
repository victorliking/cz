/**
 * Self Portrait Generator
 * Takes intake responses and produces a structured buyer portrait.
 */

export interface BuyerPortrait {
  // Hard filters
  budget: {
    comfortable: number
    stretch: number
    cities: { name: string; maxPrice: number; taxRate: number }[]
  }
  hardFilters: {
    minBedrooms: number
    minBathrooms: number
    propertyTypes: string[]
    targetCities: string[]
    commuteAnchors: string[]
  }

  // Priority vector (from ranking)
  priorities: {
    item: string
    rank: number
    weight: number // derived weight (rank 1 = 0.25, rank 8 = 0.03)
  }[]

  // Lifestyle signals
  lifestyle: {
    saturdayMorning: string[]
    hostingStyle: string | null
    renovationAppetite: string | null
  }

  // Anti-patterns (must avoid)
  dealbreakers: string[]

  // Free text insights
  freeText: {
    threeWords: string | null
    notes: string | null
  }

  // Derived insights
  insights: string[]
}

// Rank weights: #1 gets 0.25, #8 gets 0.03 (exponential decay)
const RANK_WEIGHTS = [0.25, 0.20, 0.16, 0.13, 0.10, 0.07, 0.05, 0.04]

export function generatePortrait(answers: Record<string, any>): BuyerPortrait {
  // Budget
  const budgetData = answers.budget || {}
  const cityBreakdown = (budgetData.cityBreakdown || []).map((c: any) => ({
    name: c.city,
    maxPrice: c.maxPrice,
    taxRate: c.taxRate,
  }))

  // Priorities
  const ranking = (answers.priority_ranking || []) as string[]
  const priorities = ranking.map((item, idx) => ({
    item,
    rank: idx + 1,
    weight: RANK_WEIGHTS[idx] || 0.03,
  }))

  // Lifestyle
  const saturdayMorning = (answers.saturday_morning || []) as string[]
  const hostingStyle = (answers.hosting_scenario as string) || null
  const renovationAppetite = (answers.renovation_appetite as string) || null

  // Dealbreakers
  const dealbreakers = (answers.pain_points || []) as string[]

  // Free text
  const openText = answers.open_text as { threeWords?: string; anythingElse?: string } | undefined
  const freeText = {
    threeWords: openText?.threeWords || null,
    notes: openText?.anythingElse || null,
  }

  // Derived insights
  const insights = deriveInsights(priorities, saturdayMorning, hostingStyle, dealbreakers, renovationAppetite)

  return {
    budget: {
      comfortable: budgetData.budgetRange?.[0] || 0,
      stretch: budgetData.budgetRange?.[1] || 0,
      cities: cityBreakdown,
    },
    hardFilters: {
      minBedrooms: parseInt(answers.bedrooms_min) || 1,
      minBathrooms: parseFloat(answers.bathrooms_min) || 1,
      propertyTypes: (answers.property_types || []) as string[],
      targetCities: (answers.target_areas || []) as string[],
      commuteAnchors: (answers.commute_anchors || []) as string[],
    },
    priorities,
    lifestyle: {
      saturdayMorning,
      hostingStyle,
      renovationAppetite,
    },
    dealbreakers,
    freeText,
    insights,
  }
}

function deriveInsights(
  priorities: { item: string; rank: number; weight: number }[],
  saturdayMorning: string[],
  hostingStyle: string | null,
  dealbreakers: string[],
  renovationAppetite: string | null
): string[] {
  const insights: string[] = []

  // Top priority insight
  if (priorities.length > 0) {
    const top = priorities[0]
    insights.push(`Your #1 priority is "${top.item}" — this carries ${Math.round(top.weight * 100)}% of your preference weight.`)
  }

  // Light seeker
  if (
    saturdayMorning.includes("Coffee by big windows, watching the light") ||
    dealbreakers.includes("Too dark — not enough natural light")
  ) {
    insights.push("You're a natural light seeker — we'll prioritize south/west-facing homes with large windows.")
  }

  // Social vs. private
  if (hostingStyle?.includes("Big dinner parties") || hostingStyle?.includes("Backyard BBQs")) {
    insights.push("You're a social entertainer — open floor plans and outdoor space will score higher for you.")
  } else if (hostingStyle?.includes("rarely host")) {
    insights.push("Hosting isn't a priority — we won't penalize smaller dining rooms or lack of guest space.")
  }

  // Walkability & errands
  if (
    saturdayMorning.includes("Walking to a café or farmers market") ||
    saturdayMorning.includes("Quick errands — grocery, pharmacy all nearby") ||
    dealbreakers.includes("Not walkable — have to drive for everything")
  ) {
    insights.push("Walkability & convenience matter — we'll weight Walk Score and nearby amenities.")
  }

  // Kids & family
  if (
    saturdayMorning.includes("Playing with kids in the yard") ||
    saturdayMorning.includes("Walking kids to school or the playground")
  ) {
    insights.push("Family-friendliness is key — we'll boost school ratings, parks, and safe streets.")
  }

  // Fitness & outdoors
  if (saturdayMorning.includes("Going for a run, bike ride, or to the gym")) {
    insights.push("Active lifestyle — proximity to trails, gyms, and bike paths will score higher.")
  }

  // Pet owner
  if (saturdayMorning.includes("Walking the dog in a nearby park")) {
    insights.push("Pet-friendly matters — we'll check for dog parks, trails, and pet policies.")
  }

  // Noise sensitivity
  if (dealbreakers.includes("Too noisy — street noise, neighbors")) {
    insights.push("You're noise-sensitive — we'll flag busy streets and thin-wall condos.")
  }

  // Space hungry
  if (dealbreakers.includes("Not enough space / storage")) {
    insights.push("Storage and space are pain points — square footage and closet count will weigh more.")
  }

  // Renovation attitude
  if (renovationAppetite?.includes("Turn-key")) {
    insights.push("You want move-in ready — we'll filter out major renovation projects.")
  } else if (renovationAppetite?.includes("Bring it on")) {
    insights.push("You're excited by fixer potential — we can show under-market properties with upside.")
  }

  // Three words analysis
  // (kept light — could be enhanced with NLP later)

  return insights.slice(0, 5) // Max 5 insights
}

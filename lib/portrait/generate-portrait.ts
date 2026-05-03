/**
 * Self Portrait Generator v2
 * Generates insight-driven buyer profile with contradiction detection,
 * hidden need inference, and natural language prose.
 */

export interface BuyerPortrait {
  archetype: {
    type: string
    headline: string
  }
  prose: string[]          // Natural language insight paragraphs
  blindSpots: string[]     // Things you didn't realize about yourself
  searchStrategy: string   // What type of home to actually look for
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
  priorities: { item: string; rank: number; weight: number }[]
  lifestyle: {
    saturdayMorning: string[]
    hostingStyle: string | null
    renovationAppetite: string | null
  }
  dealbreakers: string[]
  freeText: { threeWords: string | null; notes: string | null }
  // Legacy field for backwards compat
  insights: string[]
}

const RANK_WEIGHTS = [0.25, 0.20, 0.16, 0.13, 0.10, 0.07, 0.05, 0.04]

export function generatePortrait(answers: Record<string, any>): BuyerPortrait {
  // Parse raw answers
  const budgetData = answers.budget || {}
  const cityBreakdown = (budgetData.cityBreakdown || []).map((c: any) => ({
    name: c.city,
    maxPrice: c.maxPrice,
    taxRate: c.taxRate,
  }))

  const ranking = (answers.priority_ranking || []) as string[]
  const priorities = ranking.map((item, idx) => ({
    item,
    rank: idx + 1,
    weight: RANK_WEIGHTS[idx] || 0.03,
  }))

  const saturdayMorning = (answers.saturday_morning || []) as string[]
  const hostingStyle = (answers.hosting_scenario as string) || null
  const renovationAppetite = (answers.renovation_appetite as string) || null
  const dealbreakers = (answers.pain_points || []) as string[]
  const openText = answers.open_text as { threeWords?: string; anythingElse?: string } | undefined
  const freeText = {
    threeWords: openText?.threeWords || null,
    notes: openText?.anythingElse || null,
  }
  const bedroomsMin = parseInt(answers.bedrooms_min) || 1
  const targetCities = (answers.target_areas || []) as string[]
  const commuteAnchors = (answers.commute_anchors || []) as string[]

  // --- Archetype ---
  const archetype = classifyArchetype(priorities, saturdayMorning, hostingStyle)

  // --- Generate prose insights ---
  const prose = generateProse(priorities, saturdayMorning, hostingStyle, dealbreakers, renovationAppetite, budgetData, bedroomsMin)

  // --- Detect blind spots / contradictions ---
  const blindSpots = detectBlindSpots(priorities, saturdayMorning, dealbreakers, renovationAppetite, bedroomsMin, budgetData, commuteAnchors, targetCities)

  // --- Search strategy ---
  const searchStrategy = generateStrategy(archetype.type, priorities, dealbreakers, renovationAppetite, budgetData)

  return {
    archetype,
    prose,
    blindSpots,
    searchStrategy,
    budget: {
      comfortable: budgetData.budgetRange?.[0] || 0,
      stretch: budgetData.budgetRange?.[1] || 0,
      cities: cityBreakdown,
    },
    hardFilters: {
      minBedrooms: bedroomsMin,
      minBathrooms: parseFloat(answers.bathrooms_min) || 1,
      propertyTypes: (answers.property_types || []) as string[],
      targetCities,
      commuteAnchors,
    },
    priorities,
    lifestyle: { saturdayMorning, hostingStyle, renovationAppetite },
    dealbreakers,
    freeText,
    insights: [], // kept for backwards compat
  }
}

// --- Archetype classification ---
function classifyArchetype(
  priorities: { item: string; rank: number }[],
  lifestyle: string[],
  hosting: string | null
): { type: string; headline: string } {
  const top3 = priorities.slice(0, 3).map((p) => p.item)

  if (
    top3.includes("Schools & family-friendliness") ||
    top3.includes("Privacy & quiet") ||
    lifestyle.includes("Kids playing in the yard") ||
    lifestyle.includes("Walking kids to school")
  ) {
    return { type: "The Nester", headline: "You're building a home your family will grow into." }
  }

  if (
    top3.includes("Location & commute") ||
    lifestyle.includes("Walking to a café") ||
    lifestyle.includes("Errands nearby on foot")
  ) {
    return { type: "The Urbanist", headline: "You want to walk out the door and have life happen." }
  }

  if (
    top3.includes("Kitchen & entertaining") ||
    top3.includes("Outdoor space & yard") ||
    (hosting && (hosting.includes("Big dinner") || hosting.includes("Backyard")))
  ) {
    return { type: "The Entertainer", headline: "Your home is where people gather." }
  }

  if (
    top3.includes("Natural light & views") ||
    top3.includes("Finishes & move-in ready") ||
    lifestyle.includes("Coffee & morning light")
  ) {
    return { type: "The Aesthete", headline: "You feel a home before you think about it." }
  }

  if (
    top3.includes("Space & square footage") ||
    lifestyle.includes("Working from home")
  ) {
    return { type: "The Pragmatist", headline: "You see potential where others see problems." }
  }

  return { type: "The Explorer", headline: "You're still discovering what matters most." }
}

// --- Natural language prose ---
function generateProse(
  priorities: { item: string; rank: number; weight: number }[],
  lifestyle: string[],
  hosting: string | null,
  dealbreakers: string[],
  renovation: string | null,
  budget: any,
  bedrooms: number
): string[] {
  const paragraphs: string[] = []

  // Opening: what defines this buyer
  if (priorities.length >= 3) {
    const top = priorities[0].item.toLowerCase()
    const second = priorities[1].item.toLowerCase()
    paragraphs.push(
      `For you, ${top} isn't just a preference — it's the lens through which you'll judge every home you see. ${second} comes close behind. Everything else is negotiable.`
    )
  }

  // How they'll actually use the home
  const familySignals = lifestyle.filter(s =>
    s.includes("Kids") || s.includes("kids") || s.includes("school")
  )
  const soloSignals = lifestyle.filter(s =>
    s.includes("Reading") || s.includes("Coffee") || s.includes("Working")
  )
  const socialSignals = lifestyle.filter(s =>
    s.includes("Hosting") || s.includes("café")
  )

  if (familySignals.length >= 2) {
    paragraphs.push(
      "Your home will revolve around your kids — school proximity, safe outdoor space, and room to grow. You're not buying for today, you're buying for the next 7-10 years."
    )
  } else if (soloSignals.length >= 2) {
    paragraphs.push(
      "You need a home that gives you space to think. Quiet mornings, a corner for work, good light. The house should feel calm even when life isn't."
    )
  } else if (socialSignals.length >= 1 && hosting?.includes("Big dinner")) {
    paragraphs.push(
      "You'll use this home to bring people together. The kitchen island, the dining table, the backyard — they're not features, they're how you live."
    )
  }

  // Renovation truth
  if (renovation?.includes("Turn-key")) {
    paragraphs.push(
      "You want to move in and not touch anything. That's valid — but it means your budget needs to stretch further, because move-in ready commands a 10-15% premium in this market."
    )
  } else if (renovation?.includes("Cosmetic")) {
    paragraphs.push(
      "You say cosmetic is fine — but pay attention to what's actually cosmetic vs what's structural. New paint is cosmetic. A cramped kitchen layout is not. Be honest about where your line is."
    )
  } else if (renovation?.includes("Bring it on")) {
    paragraphs.push(
      "You're open to renovation — that's your competitive advantage. You can bid on homes others skip, offer less, and build exactly what you want. Factor $50-80k renovation budget on top of purchase price."
    )
  }

  return paragraphs
}

// --- Blind spots & contradictions ---
function detectBlindSpots(
  priorities: { item: string; rank: number }[],
  lifestyle: string[],
  dealbreakers: string[],
  renovation: string | null,
  bedrooms: number,
  budget: any,
  commutes: string[],
  cities: string[]
): string[] {
  const spots: string[] = []
  const top3 = priorities.slice(0, 3).map((p) => p.item)

  // Contradiction: quiet + walkable
  const wantsQuiet = top3.includes("Privacy & quiet") || dealbreakers.includes("Too noisy — street noise, neighbors")
  const wantsWalkable = lifestyle.includes("Walking to a café") || lifestyle.includes("Errands nearby on foot") || dealbreakers.includes("Not walkable — have to drive for everything")

  if (wantsQuiet && wantsWalkable) {
    spots.push(
      "You want both quiet and walkability — these usually conflict. High Walk Score streets are busier. Look for homes on side streets within 2-3 blocks of a main street: close enough to walk, far enough to sleep."
    )
  }

  // Contradiction: cosmetic OK but kitchen dealbreaker
  if (renovation?.includes("Cosmetic") && dealbreakers.includes("Kitchen is too small or outdated")) {
    spots.push(
      "You said cosmetic updates are fine, but an outdated kitchen is a dealbreaker. A kitchen renovation isn't cosmetic — it's $30-60k and 2-3 months. You actually need a home with the kitchen already done."
    )
  }

  // Hidden need: bedroom count too low
  const hasKids = lifestyle.includes("Kids playing in the yard") || lifestyle.includes("Walking kids to school")
  const wfh = lifestyle.includes("Working from home")
  if (bedrooms <= 3 && hasKids && wfh) {
    spots.push(
      `You said ${bedrooms} bedrooms minimum, but you have kids and work from home. That's master + kid room + office = ${bedrooms} with zero flexibility. If there's any chance of another child or hosting family, you actually need ${bedrooms + 1}.`
    )
  }

  // Budget vs expectations
  if (budget.budgetRange && top3.includes("Schools & family-friendliness") && cities.length > 0) {
    spots.push(
      "Good school districts command a premium. In Greater Boston, the difference between a 6-rated and 8-rated school district can be $100-200k on the same house. Make sure your budget accounts for the school quality you actually want."
    )
  }

  // Dual commute pressure
  if (commutes.length >= 2) {
    spots.push(
      "With two commute destinations, you're constrained geographically. Map both commutes before falling in love with a neighborhood — a home that's great for one commute might add 20 minutes to the other."
    )
  }

  return spots.slice(0, 4) // Max 4 blind spots
}

// --- Search strategy recommendation ---
function generateStrategy(
  archetype: string,
  priorities: { item: string; rank: number }[],
  dealbreakers: string[],
  renovation: string | null,
  budget: any
): string {
  const parts: string[] = []

  parts.push("Based on everything you've told us, here's what we should actually be looking for:")

  if (archetype === "The Nester") {
    parts.push("A home on a quiet residential street in a top school district, with a fenced yard and enough bedrooms to grow into. Updated kitchen is non-negotiable. Ideally Colonial or Cape style, 1,800+ sqft.")
  } else if (archetype === "The Urbanist") {
    parts.push("A well-located home where daily life is walkable — grocery, café, transit all close. You'll trade size for location. Condo or townhouse in a village center, or a compact single-family on a side street near Main St.")
  } else if (archetype === "The Entertainer") {
    parts.push("An open-concept home with a real kitchen, flow between indoor and outdoor, and space for a crowd. Deck or patio is as important as an extra bedroom. Single-family with a flat, usable yard.")
  } else if (archetype === "The Aesthete") {
    parts.push("A home with soul — great light, interesting architecture, quality finishes. You'd rather have a smaller, beautiful home than a bigger bland one. Look for south-facing, high ceilings, and character details.")
  } else if (archetype === "The Pragmatist") {
    parts.push("A home with good bones and upside potential. Below-market properties that need work are your sweet spot. Focus on layout, lot size, and location — everything else can be changed.")
  } else {
    parts.push("We'll cast a wide net at first and narrow based on your reactions to actual homes. Your preferences will sharpen as you see real options.")
  }

  if (renovation?.includes("Turn-key")) {
    parts.push("Only homes renovated in the last 5 years or new construction.")
  }

  return parts.join(" ")
}

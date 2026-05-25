/**
 * Style Match Scorer
 *
 * Computes a 0-100 match score between a buyer's style preferences
 * and a listing's AI-classified style tags.
 *
 * Weighting:
 *   - architectural_style: 40%  (most defining feature)
 *   - overall_vibe: 25%         (emotional resonance)
 *   - era_feel: 15%             (period preference)
 *   - exterior_material: 10%    (surface-level preference)
 *   - landscape_style: 5%       (often secondary)
 *   - color_palette: 5%         (subtle preference)
 */

import type { BuyerStylePreferences, StyleClassification } from "./style-tags"

interface CategoryWeight {
  category: keyof StyleClassification
  weight: number
}

const CATEGORY_WEIGHTS: CategoryWeight[] = [
  { category: "architectural_style", weight: 0.40 },
  { category: "overall_vibe", weight: 0.25 },
  { category: "era_feel", weight: 0.15 },
  { category: "exterior_material", weight: 0.10 },
  { category: "landscape_style", weight: 0.05 },
  { category: "color_palette", weight: 0.05 },
]

/**
 * Score how well a listing's style matches a buyer's preferences.
 *
 * @param buyerPrefs - Buyer's selected style preferences (from questionnaire)
 * @param listingStyle - AI-classified style tags for a listing
 * @returns 0-100 score (100 = perfect style match)
 */
export function computeStyleMatchScore(
  buyerPrefs: BuyerStylePreferences,
  listingStyle: StyleClassification
): number {
  let totalScore = 0
  let totalWeight = 0

  for (const { category, weight } of CATEGORY_WEIGHTS) {
    const categoryScore = scoreCategoryMatch(category, buyerPrefs, listingStyle)
    if (categoryScore !== null) {
      totalScore += categoryScore * weight
      totalWeight += weight
    }
  }

  // If no preferences were expressed, return a neutral 50
  if (totalWeight === 0) return 50

  // Normalize to account for only the categories where buyer expressed preferences
  return Math.round((totalScore / totalWeight) * 100)
}

/**
 * Score a single category's match. Returns null if buyer has no preference
 * for this category (so it won't drag scores down).
 */
function scoreCategoryMatch(
  category: keyof StyleClassification,
  buyerPrefs: BuyerStylePreferences,
  listingStyle: StyleClassification
): number | null {
  const listingValue = listingStyle[category]
  const buyerValue = getBuyerPreference(category, buyerPrefs)

  // If buyer has no preference for this category, skip it
  if (buyerValue === null) return null

  // Array vs array match (architectural_style, exterior_material, overall_vibe)
  if (Array.isArray(listingValue) && Array.isArray(buyerValue)) {
    return computeArrayOverlap(buyerValue, listingValue)
  }

  // Single value vs array match (era_feel, landscape_style, color_palette)
  if (typeof listingValue === "string" && Array.isArray(buyerValue)) {
    return buyerValue.includes(listingValue) ? 1.0 : 0.0
  }

  // Single value vs single value
  if (typeof listingValue === "string" && typeof buyerValue === "string") {
    return listingValue === buyerValue ? 1.0 : 0.0
  }

  return null
}

/**
 * Get the buyer's preference for a given category, normalized to a string[].
 * Returns null if the buyer hasn't expressed a preference.
 */
function getBuyerPreference(
  category: keyof StyleClassification,
  buyerPrefs: BuyerStylePreferences
): string[] | null {
  switch (category) {
    case "architectural_style":
      return buyerPrefs.architectural_style?.length
        ? [...buyerPrefs.architectural_style]
        : null
    case "exterior_material":
      return buyerPrefs.exterior_material?.length
        ? [...buyerPrefs.exterior_material]
        : null
    case "era_feel":
      return buyerPrefs.era_feel?.length ? [...buyerPrefs.era_feel] : null
    case "landscape_style":
      return buyerPrefs.landscape_style?.length
        ? [...buyerPrefs.landscape_style]
        : null
    case "overall_vibe":
      return buyerPrefs.overall_vibe?.length
        ? [...buyerPrefs.overall_vibe]
        : null
    case "color_palette":
      return buyerPrefs.color_palette?.length
        ? [...buyerPrefs.color_palette]
        : null
    default:
      return null
  }
}

/**
 * Compute overlap between buyer's preferred tags and listing's tags.
 * Returns 0.0 to 1.0 — any overlap yields at least partial credit.
 *
 * Scoring logic:
 * - Full overlap (all buyer picks match): 1.0
 * - Partial overlap: proportional to how many buyer picks are matched
 * - No overlap: 0.0
 */
function computeArrayOverlap(
  buyerTags: string[],
  listingTags: string[]
): number {
  if (buyerTags.length === 0) return 0

  const listingSet = new Set(listingTags)
  const matches = buyerTags.filter((tag) => listingSet.has(tag)).length

  // We score based on the proportion of buyer preferences satisfied
  return matches / buyerTags.length
}

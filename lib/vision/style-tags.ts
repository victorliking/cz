/**
 * Style Tags Taxonomy
 *
 * Shared vocabulary for both the AI vision classifier and the buyer
 * style questionnaire. Any tag the classifier can return must exist here,
 * and any tag the buyer can pick must also exist here.
 */

export const STYLE_CATEGORIES = {
  architectural: [
    "colonial",
    "cape_cod",
    "craftsman",
    "contemporary",
    "ranch",
    "victorian",
    "farmhouse",
    "tudor",
    "mid_century",
    "split_level",
    "garrison",
    "greek_revival",
  ] as const,

  material: [
    "clapboard",
    "brick",
    "stone",
    "shingle",
    "stucco",
    "vinyl",
    "wood",
    "fiber_cement",
  ] as const,

  era: [
    "historic",
    "mid_century",
    "contemporary",
    "new_construction",
  ] as const,

  landscape: [
    "mature_trees",
    "manicured",
    "minimal",
    "natural",
    "urban",
  ] as const,

  vibe: [
    "classic",
    "charming",
    "stately",
    "cozy",
    "minimalist",
    "warm",
    "grand",
    "cottage",
    "elegant",
    "rustic",
  ] as const,

  color_palette: [
    "warm",
    "neutral",
    "cool",
    "bold",
  ] as const,
} as const

export type ArchitecturalStyle = (typeof STYLE_CATEGORIES.architectural)[number]
export type ExteriorMaterial = (typeof STYLE_CATEGORIES.material)[number]
export type EraFeel = (typeof STYLE_CATEGORIES.era)[number]
export type LandscapeStyle = (typeof STYLE_CATEGORIES.landscape)[number]
export type VibeTag = (typeof STYLE_CATEGORIES.vibe)[number]
export type ColorPalette = (typeof STYLE_CATEGORIES.color_palette)[number]

/**
 * The structured output returned by the AI vision classifier.
 */
export interface StyleClassification {
  architectural_style: ArchitecturalStyle[]
  exterior_material: ExteriorMaterial[]
  era_feel: EraFeel
  landscape_style: LandscapeStyle
  overall_vibe: VibeTag[]
  color_palette: ColorPalette
}

/**
 * Buyer style preferences (from visual questionnaire picks).
 * Mirrors StyleClassification but everything is optional since a buyer
 * might only express preferences on a subset of categories.
 */
export interface BuyerStylePreferences {
  architectural_style?: ArchitecturalStyle[]
  exterior_material?: ExteriorMaterial[]
  era_feel?: EraFeel[]
  landscape_style?: LandscapeStyle[]
  overall_vibe?: VibeTag[]
  color_palette?: ColorPalette[]
}

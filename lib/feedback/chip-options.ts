export interface FeedbackChip {
  label: string
  keywords: string[]
}

export const FEEDBACK_CHIPS: FeedbackChip[] = [
  { label: "Bright & sunny", keywords: ["bright", "sunny", "light"] },
  { label: "Quiet & private", keywords: ["quiet", "private", "peaceful"] },
  { label: "Spacious", keywords: ["spacious", "big", "roomy"] },
  { label: "Open layout", keywords: ["open"] },
  { label: "Great kitchen", keywords: ["kitchen", "cooking", "island"] },
  { label: "Yard / outdoor", keywords: ["yard", "garden", "outdoor", "patio", "deck"] },
  { label: "Good schools", keywords: ["school", "family", "kids", "safe"] },
  { label: "Walkable / transit", keywords: ["walkable", "transit", "commute", "location", "close"] },
  { label: "Updated / modern", keywords: ["updated", "renovated", "modern", "new", "move-in"] },
  { label: "Great for hosting", keywords: ["entertaining"] },
  { label: "Character & charm", keywords: ["charm", "character"] },
]

export function chipsToKeywordString(selectedLabels: string[]): string {
  return selectedLabels
    .flatMap((label) => {
      const chip = FEEDBACK_CHIPS.find((c) => c.label === label)
      return chip ? chip.keywords : []
    })
    .join(", ")
}

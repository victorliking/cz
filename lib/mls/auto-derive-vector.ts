/**
 * Auto-Derive Vector Dimensions from MLS Listing Data
 *
 * When listings are imported from MLS, most scoring dimensions are null because
 * they normally require agent walkthrough. This module derives reasonable estimates
 * from available MLS data (remarks, lot size, year built, street name, features)
 * so that the match engine produces differentiated scores instead of flat ~60%.
 *
 * Derived dimensions (1-5 scale unless noted):
 *   - move_in_readiness: from yearBuilt, yearRenovated, remarks keywords
 *   - yard_usability: from lotSqft thresholds
 *   - openness: from interior features / remarks keywords
 *   - natural_light: from remarks keywords
 *   - noise_level: from street name patterns (default 3)
 *   - privacy: from lot size + corner lot detection
 *   - kitchen_quality: from finish keywords in remarks/features
 */

import type { MappedListing } from './field-map'

export interface DerivedDimensions {
  move_in_readiness: number | null
  yard_usability: number | null
  openness: number | null
  natural_light: number | null
  noise_level: number | null
  privacy: number | null
  kitchen_quality: number | null
}

/**
 * Derive scoring dimensions from raw MLS listing data.
 * Returns values on 1-5 scale (or null if truly insufficient data).
 */
export function autoDeriveVector(listing: MappedListing): DerivedDimensions {
  const remarks = (listing.description || '').toLowerCase()
  const interiorFeatures = (listing.interiorFeatures || '').toLowerCase()
  const allText = `${remarks} ${interiorFeatures}`

  return {
    move_in_readiness: deriveMoveInReadiness(listing, remarks),
    yard_usability: deriveYardUsability(listing.lotSqft, listing.propertyType),
    openness: deriveOpenness(allText),
    natural_light: deriveNaturalLight(allText),
    noise_level: deriveNoiseLevel(listing.address),
    privacy: derivePrivacy(listing.lotSqft, allText),
    kitchen_quality: deriveKitchenQuality(allText, listing.appliances),
  }
}

// ─── Move-In Readiness ────────────────────────────────────────

const POSITIVE_CONDITION_KEYWORDS = [
  'renovated', 'updated', 'remodeled', 'new kitchen', 'new bath',
  'new roof', 'new hvac', 'move-in ready', 'move in ready', 'turnkey',
  'pristine', 'meticulously', 'mint condition', 'like new',
  'fully renovated', 'gut renovated', 'newly renovated',
  'brand new', 'new construction',
]

const NEGATIVE_CONDITION_KEYWORDS = [
  'original', 'needs work', 'handyman', 'as-is', 'as is',
  'fixer', 'estate sale', 'investor', 'needs updating',
  'dated', 'cosmetic', 'deferred maintenance', 'tlc',
  'tear down', 'needs renovation', 'sold as-is',
]

function deriveMoveInReadiness(listing: MappedListing, remarks: string): number {
  let score = 3 // default neutral

  // Year-based baseline
  const currentYear = new Date().getFullYear()
  if (listing.yearBuilt) {
    const age = currentYear - listing.yearBuilt
    if (age <= 5) score = 5
    else if (age <= 15) score = 4
    else if (age <= 30) score = 3
    else if (age <= 50) score = 2
    else score = 2
  }

  // Keyword adjustments
  const positiveHits = POSITIVE_CONDITION_KEYWORDS.filter(kw => remarks.includes(kw)).length
  const negativeHits = NEGATIVE_CONDITION_KEYWORDS.filter(kw => remarks.includes(kw)).length

  if (positiveHits >= 2) score = Math.min(5, score + 2)
  else if (positiveHits === 1) score = Math.min(5, score + 1)

  if (negativeHits >= 2) score = Math.max(1, score - 2)
  else if (negativeHits === 1) score = Math.max(1, score - 1)

  return clamp(score, 1, 5)
}

// ─── Yard Usability ───────────────────────────────────────────

function deriveYardUsability(lotSqft: number | null, propertyType: string): number | null {
  // Condos typically have no private yard
  if (propertyType === 'CONDO' || propertyType === 'COOP') return 1

  if (!lotSqft) return null // Cannot determine without lot data

  if (lotSqft < 2000) return 1
  if (lotSqft < 5000) return 2
  if (lotSqft < 10000) return 3
  if (lotSqft < 20000) return 4
  return 5
}

// ─── Openness ─────────────────────────────────────────────────

const OPEN_KEYWORDS = [
  'open concept', 'open floor plan', 'open floor', 'great room',
  'cathedral ceiling', 'vaulted ceiling', 'open layout',
  'flows seamlessly', 'open living', 'open kitchen',
  'loft', 'two-story foyer', 'soaring',
]

const CLOSED_KEYWORDS = [
  'formal rooms', 'separate rooms', 'traditional layout',
  'closed floor plan', 'compartmentalized',
]

function deriveOpenness(allText: string): number {
  let score = 3

  const openHits = OPEN_KEYWORDS.filter(kw => allText.includes(kw)).length
  const closedHits = CLOSED_KEYWORDS.filter(kw => allText.includes(kw)).length

  if (openHits >= 2) score = 5
  else if (openHits === 1) score = 4

  if (closedHits >= 1) score = Math.max(2, score - 1)

  return clamp(score, 1, 5)
}

// ─── Natural Light ────────────────────────────────────────────

const BRIGHT_KEYWORDS = [
  'sun-drenched', 'sundrenched', 'sun drenched', 'bright',
  'south-facing', 'south facing', 'skylights', 'skylight',
  'floor-to-ceiling windows', 'wall of windows', 'lots of light',
  'natural light', 'sun-filled', 'sunlit', 'sun filled',
  'light-filled', 'light filled', 'windows galore',
]

const DARK_KEYWORDS = [
  'dark', 'north-facing', 'north facing', 'limited light',
  'no natural light', 'below grade',
]

function deriveNaturalLight(allText: string): number {
  let score = 3

  const brightHits = BRIGHT_KEYWORDS.filter(kw => allText.includes(kw)).length
  const darkHits = DARK_KEYWORDS.filter(kw => allText.includes(kw)).length

  if (brightHits >= 2) score = 5
  else if (brightHits === 1) score = 4

  if (darkHits >= 1) score = Math.max(1, score - 2)

  return clamp(score, 1, 5)
}

// ─── Noise Level ──────────────────────────────────────────────

const NOISY_STREET_PATTERNS = [
  'highway', 'route ', 'rt ', 'turnpike', 'pike',
  'boulevard', 'blvd', 'expressway', 'interstate',
  'state rd', 'state road',
]

const QUIET_STREET_PATTERNS = [
  'court', ' ct', 'circle', 'lane', ' ln',
  'way', 'path', 'trail', 'terrace', 'place',
]

function deriveNoiseLevel(address: string): number {
  const lower = address.toLowerCase()

  const noisyMatch = NOISY_STREET_PATTERNS.some(p => lower.includes(p))
  const quietMatch = QUIET_STREET_PATTERNS.some(p => lower.includes(p))

  if (noisyMatch) return 2
  if (quietMatch) return 4
  return 3 // default: average residential street
}

// ─── Privacy ──────────────────────────────────────────────────

function derivePrivacy(lotSqft: number | null, allText: string): number {
  let score = 3

  // Lot size is the primary driver
  if (lotSqft) {
    if (lotSqft >= 40000) score = 5
    else if (lotSqft >= 20000) score = 4
    else if (lotSqft >= 10000) score = 3
    else if (lotSqft >= 5000) score = 2
    else score = 2
  }

  // Corner lots tend to have less privacy (more exposed)
  if (allText.includes('corner lot')) {
    score = Math.max(1, score - 1)
  }

  // Wooded / private / secluded boost
  if (allText.includes('private') || allText.includes('secluded') || allText.includes('wooded')) {
    score = Math.min(5, score + 1)
  }

  return clamp(score, 1, 5)
}

// ─── Kitchen Quality ──────────────────────────────────────────

const HIGH_KITCHEN_KEYWORDS = [
  'granite', 'quartz', 'stainless', 'stainless steel',
  'chef', "chef's kitchen", 'sub-zero', 'subzero',
  'wolf', 'viking', 'thermador', 'bosch',
  'marble counter', 'custom cabinet', 'soft close',
  'waterfall island', 'pot filler', 'butler pantry',
]

const LOW_KITCHEN_KEYWORDS = [
  'original kitchen', 'dated kitchen', 'laminate',
  'formica', 'needs kitchen', 'older kitchen',
  'outdated kitchen', 'linoleum',
]

function deriveKitchenQuality(allText: string, appliances: string | null): number {
  const appliancesText = (appliances || '').toLowerCase()
  const combined = `${allText} ${appliancesText}`

  let score = 3

  const highHits = HIGH_KITCHEN_KEYWORDS.filter(kw => combined.includes(kw)).length
  const lowHits = LOW_KITCHEN_KEYWORDS.filter(kw => combined.includes(kw)).length

  if (highHits >= 3) score = 5
  else if (highHits >= 1) score = 4

  if (lowHits >= 2) score = Math.max(1, score - 2)
  else if (lowHits === 1) score = Math.max(2, score - 1)

  return clamp(score, 1, 5)
}

// ─── Utility ──────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

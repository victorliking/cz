export type DataType = 'number' | 'enum' | 'bool' | 'score_1_5'
export type Source = 'mls' | 'agent' | 'derived'
export type Group =
  | 'facts' | 'location' | 'building' | 'layout'
  | 'sensory' | 'outdoor' | 'neighborhood' | 'derived'

export interface Dimension {
  key: string
  label: string
  group: Group
  dataType: DataType
  source: Source
  enumValues?: string[]
  description?: string
}

export const DIMENSIONS: Dimension[] = [
  // facts
  { key: 'price', label: 'Price', group: 'facts', dataType: 'number', source: 'mls' },
  { key: 'price_per_sqft', label: 'Price/sqft', group: 'facts', dataType: 'number', source: 'derived' },
  { key: 'bedrooms', label: 'Bedrooms', group: 'facts', dataType: 'number', source: 'mls' },
  { key: 'bathrooms', label: 'Bathrooms', group: 'facts', dataType: 'number', source: 'mls' },
  { key: 'interior_sqft', label: 'Interior sqft', group: 'facts', dataType: 'number', source: 'mls' },
  { key: 'lot_sqft', label: 'Lot sqft', group: 'facts', dataType: 'number', source: 'mls' },
  { key: 'year_built', label: 'Year built', group: 'facts', dataType: 'number', source: 'mls' },

  // location
  { key: 'walk_score', label: 'Walkability', group: 'location', dataType: 'number', source: 'derived' },
  { key: 'commute_minutes_primary', label: 'Commute (primary)', group: 'location', dataType: 'number', source: 'derived' },
  { key: 'school_rating', label: 'School rating', group: 'location', dataType: 'number', source: 'mls' },
  { key: 'noise_level', label: 'Quietness', group: 'location', dataType: 'score_1_5', source: 'agent' },
  { key: 'street_type', label: 'Street type', group: 'location', dataType: 'enum', source: 'agent',
    enumValues: ['quiet_residential', 'busy_residential', 'arterial', 'cul_de_sac'] },

  // building
  { key: 'roof_age_years', label: 'Roof age', group: 'building', dataType: 'number', source: 'agent' },
  { key: 'hvac_age_years', label: 'HVAC age', group: 'building', dataType: 'number', source: 'agent' },
  { key: 'has_solar', label: 'Solar panels', group: 'building', dataType: 'bool', source: 'mls' },
  { key: 'heating_type', label: 'Heating', group: 'building', dataType: 'enum', source: 'mls',
    enumValues: ['gas', 'electric', 'heat_pump', 'oil', 'radiant'] },

  // layout
  { key: 'openness', label: 'Open layout', group: 'layout', dataType: 'score_1_5', source: 'agent' },
  { key: 'kitchen_layout', label: 'Kitchen layout', group: 'layout', dataType: 'enum', source: 'agent',
    enumValues: ['galley', 'u_shape', 'l_shape', 'island', 'peninsula', 'open_great_room'] },
  { key: 'has_dining_room', label: 'Formal dining', group: 'layout', dataType: 'bool', source: 'agent' },
  { key: 'home_office_count', label: 'Home offices', group: 'layout', dataType: 'number', source: 'agent' },
  { key: 'storage_abundance', label: 'Storage', group: 'layout', dataType: 'score_1_5', source: 'agent' },
  { key: 'ceiling_height_feet', label: 'Ceiling height', group: 'layout', dataType: 'number', source: 'agent' },

  // sensory — high-value agent input
  { key: 'natural_light', label: 'Natural light', group: 'sensory', dataType: 'score_1_5', source: 'agent' },
  { key: 'view_quality', label: 'View quality', group: 'sensory', dataType: 'score_1_5', source: 'agent' },
  { key: 'privacy_from_neighbors', label: 'Privacy', group: 'sensory', dataType: 'score_1_5', source: 'agent' },
  { key: 'finish_quality', label: 'Finish quality', group: 'sensory', dataType: 'enum', source: 'agent',
    enumValues: ['builder_grade', 'mid', 'high_end', 'luxury'] },
  { key: 'move_in_readiness', label: 'Move-in ready', group: 'sensory', dataType: 'score_1_5', source: 'agent' },

  // outdoor
  { key: 'yard_size_category', label: 'Yard size', group: 'outdoor', dataType: 'enum', source: 'agent',
    enumValues: ['none', 'small', 'medium', 'large'] },
  { key: 'yard_usability', label: 'Yard usability', group: 'outdoor', dataType: 'score_1_5', source: 'agent' },
  { key: 'is_fenced', label: 'Fenced', group: 'outdoor', dataType: 'bool', source: 'agent' },
  { key: 'has_outdoor_space', label: 'Has outdoor space', group: 'outdoor', dataType: 'bool', source: 'agent' },

  // neighborhood
  { key: 'vibe', label: 'Neighborhood vibe', group: 'neighborhood', dataType: 'enum', source: 'agent',
    enumValues: ['quiet', 'lively', 'sleepy', 'up_and_coming', 'established'] },
  { key: 'street_parking_ease', label: 'Parking ease', group: 'neighborhood', dataType: 'score_1_5', source: 'agent' },

  // derived
  { key: 'commute_weighted_score', label: 'Commute fit', group: 'derived', dataType: 'number', source: 'derived' },
  { key: 'stretch_pct', label: 'Budget stretch', group: 'derived', dataType: 'number', source: 'derived' },
]

// --- Helpers ---

/** All dimension keys as a type-safe array */
export const DIMENSION_KEYS = DIMENSIONS.map((d) => d.key)

/** Lookup a single dimension by key. Throws if not found. */
export function getDimension(key: string): Dimension {
  const dim = DIMENSIONS.find((d) => d.key === key)
  if (!dim) throw new Error(`Unknown dimension key: "${key}"`)
  return dim
}

/** Get all dimensions in a given group */
export function getByGroup(group: Group): Dimension[] {
  return DIMENSIONS.filter((d) => d.group === group)
}

/** All unique groups in display order */
export const GROUPS: Group[] = [
  'facts', 'location', 'building', 'layout',
  'sensory', 'outdoor', 'neighborhood', 'derived',
]

/**
 * Validate a vector object. Returns errors array (empty = valid).
 * Rules:
 * - Only known dimension keys allowed
 * - Values must be null or match expected type
 * - Missing keys are acceptable (treated as null)
 */
export function validateVector(obj: Record<string, unknown>): string[] {
  const errors: string[] = []
  const knownKeys = new Set(DIMENSION_KEYS)

  for (const [key, value] of Object.entries(obj)) {
    if (!knownKeys.has(key)) {
      errors.push(`Unknown dimension key: "${key}"`)
      continue
    }

    if (value === null) continue // null is always valid (unknown data)

    const dim = getDimension(key)

    switch (dim.dataType) {
      case 'number':
        if (typeof value !== 'number') {
          errors.push(`"${key}" expected number, got ${typeof value}`)
        }
        break
      case 'score_1_5':
        if (typeof value !== 'number' || value < 1 || value > 5) {
          errors.push(`"${key}" expected number 1-5, got ${value}`)
        }
        break
      case 'bool':
        if (typeof value !== 'boolean') {
          errors.push(`"${key}" expected boolean, got ${typeof value}`)
        }
        break
      case 'enum':
        if (typeof value !== 'string' || !dim.enumValues?.includes(value)) {
          errors.push(`"${key}" expected one of [${dim.enumValues?.join(', ')}], got "${value}"`)
        }
        break
    }
  }

  return errors
}

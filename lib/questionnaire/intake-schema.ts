/**
 * Intake questionnaire — 14 questions (Q12-Q13 skipped in v1).
 * Each question has:
 * - id: unique key
 * - type: input type
 * - label: main question text
 * - subtitle: helper text
 * - required: whether skip is allowed
 * - options: for chip/ranking types
 * - immediateValue: function or template for showing value back to buyer
 */

export type QuestionType =
  | 'dual_slider'
  | 'affordability'
  | 'chip_single'
  | 'chip_multi'
  | 'multi_input'
  | 'repeater'
  | 'ranking'
  | 'open_text'

export interface IntakeQuestion {
  id: string
  type: QuestionType
  label: string
  subtitle?: string
  required: boolean
  options?: string[]
  maxSelections?: number
  immediateValueTemplate?: string
  skipInV1?: boolean
}

export const INTAKE_QUESTIONS: IntakeQuestion[] = [
  // Q1: Affordability Calculator
  {
    id: 'budget',
    type: 'affordability',
    label: 'Let\'s figure out what you can afford',
    subtitle: 'We\'ll calculate your buying power per city, including taxes and insurance.',
    required: true,
  },

  // Q2: Bedrooms
  {
    id: 'bedrooms_min',
    type: 'chip_single',
    label: 'Minimum bedrooms?',
    subtitle: 'What\'s the fewest bedrooms that could work?',
    required: true,
    options: ['1', '2', '3', '4', '5+'],
  },

  // Q3: Bathrooms
  {
    id: 'bathrooms_min',
    type: 'chip_single',
    label: 'Minimum bathrooms?',
    subtitle: 'Including half-baths.',
    required: true,
    options: ['1', '1.5', '2', '2.5', '3+'],
  },

  // Q4: Property types
  {
    id: 'property_types',
    type: 'chip_multi',
    label: 'What types of homes are you open to?',
    subtitle: 'Select all that apply.',
    required: true,
    options: ['Single Family', 'Condo', 'Townhouse', 'Multi-family', 'Any'],
  },

  // Q5: Target cities/zips
  {
    id: 'target_areas',
    type: 'multi_input',
    label: 'What cities or neighborhoods are you targeting?',
    subtitle: 'Type and press Enter. You can add multiple.',
    required: true,
  },

  // Q6: Commute anchors
  {
    id: 'commute_anchors',
    type: 'repeater',
    label: 'Where do you commute to?',
    subtitle: 'Add addresses you need to be close to (work, school, family). We\'ll calculate drive times.',
    required: true,
  },

  // Q7: Forced ranking ⭐ (signal strength 0.3)
  {
    id: 'priority_ranking',
    type: 'ranking',
    label: 'Rank what matters most to you',
    subtitle: 'Drag to reorder. This forces real trade-offs — there\'s no "all of them" option.',
    required: true,
    options: [
      'Location & commute',
      'Space & square footage',
      'Schools & family-friendliness',
      'Outdoor space & yard',
      'Kitchen & entertaining',
      'Natural light & views',
      'Finishes & move-in ready',
      'Privacy & quiet',
    ],
    immediateValueTemplate: 'Compared to most first-time buyers, you weight {top} higher than average',
  },

  // Q8: Saturday morning scenario (signal strength 0.4)
  {
    id: 'saturday_morning',
    type: 'chip_multi',
    label: 'It\'s Saturday morning in your dream home. What are you doing?',
    subtitle: 'Pick up to 3 that feel most like you.',
    required: false,
    maxSelections: 4,
    options: [
      'Coffee & morning light',
      'Cooking in a big kitchen',
      'Kids playing in the yard',
      'Walking kids to school',
      'Working from home',
      'Reading in silence',
      'Walking to a café',
      'Errands nearby on foot',
      'Running or biking',
      'Gardening outside',
      'Walking the dog',
      'Hosting friends',
    ],
  },

  // Q9: Hosting scenario (signal strength 0.4)
  {
    id: 'hosting_scenario',
    type: 'chip_single',
    label: 'When friends come over, what does "hosting" look like for you?',
    subtitle: 'Pick the one that fits best.',
    required: false,
    options: [
      'Big dinner parties — need a real dining room',
      'Casual hangs — open kitchen/living is key',
      'Backyard BBQs and outdoor entertaining',
      'Intimate — just a couple friends, cozy space',
      'We rarely host — not a priority',
    ],
  },

  // Q10: Current home pain points (signal strength 0.4)
  {
    id: 'pain_points',
    type: 'chip_multi',
    label: 'What bothers you most about where you live now?',
    subtitle: 'Pick up to 4. We\'ll actively avoid these in your recommendations.',
    required: false,
    maxSelections: 4,
    options: [
      'Too dark — not enough natural light',
      'Too noisy — street noise, neighbors',
      'Not enough space / storage',
      'Bad layout — rooms feel disconnected',
      'Kitchen is too small or outdated',
      'No outdoor space',
      'Too far from work / long commute',
      'Not walkable — have to drive for everything',
      'Parking is a nightmare',
      'Feels dated — needs too much work',
    ],
    immediateValueTemplate: 'Got it — we\'ll avoid these in your recommendations',
  },

  // Q11: Renovation appetite
  {
    id: 'renovation_appetite',
    type: 'chip_single',
    label: 'How do you feel about renovation?',
    subtitle: 'Be honest — this really affects which homes we show you.',
    required: false,
    options: [
      'Turn-key only — I want to move in and not touch anything',
      'Cosmetic is fine — paint, fixtures, minor updates',
      'Moderate — I\'d take on a kitchen or bathroom redo',
      'Bring it on — I\'m excited by fixer potential',
    ],
  },

  // Q12: Architectural style preference
  {
    id: 'home_style',
    type: 'chip_multi',
    label: 'What architectural styles appeal to you?',
    subtitle: 'Pick up to 3. This helps us filter homes by look and feel.',
    required: false,
    maxSelections: 3,
    options: [
      'Colonial',
      'Cape Cod',
      'Craftsman',
      'Contemporary / Modern',
      'Ranch / Single-story',
      'Victorian',
      'Farmhouse',
      'Townhouse / Row',
      'No preference',
    ],
  },

  // Q13: Era / age preference
  {
    id: 'home_era',
    type: 'chip_single',
    label: 'How old of a home are you comfortable with?',
    subtitle: 'Older homes have charm but may need more maintenance.',
    required: false,
    options: [
      'New construction only (2020+)',
      'Recently built (2000–2020)',
      'Updated classic (pre-2000, renovated)',
      'Character home (original condition, pre-1970)',
      'No preference on age',
    ],
  },

  // Q14: Materials / features that matter
  {
    id: 'home_features',
    type: 'chip_multi',
    label: 'Which features make a home feel like yours?',
    subtitle: 'Pick up to 4.',
    required: false,
    maxSelections: 4,
    options: [
      'Hardwood floors',
      'Open floor plan',
      'High ceilings',
      'Large windows',
      'Modern kitchen appliances',
      'Original woodwork & built-ins',
      'Finished basement',
      'Garage (1+ car)',
      'Central AC',
      'Fireplace',
    ],
  },

  // Q15: Lighting / orientation
  {
    id: 'light_preference',
    type: 'chip_single',
    label: 'When does natural light matter most to you?',
    subtitle: 'This helps us evaluate home orientation.',
    required: false,
    options: [
      'Morning light (east-facing) — I\'m an early riser',
      'Afternoon sun (south/west) — warm and bright',
      'All-day light — as much as possible',
      'Soft, indirect — I don\'t want harsh glare',
      'Not a big factor for me',
    ],
  },

  // Q16: Move-in timeline
  {
    id: 'move_timeline',
    type: 'chip_single',
    label: 'How soon do you need to move in?',
    subtitle: 'This affects which homes we prioritize.',
    required: false,
    options: [
      'ASAP — within 2 months',
      '3–6 months',
      '6–12 months — no rush',
      'Just exploring for now',
    ],
  },

  // Q17: Budget flexibility
  {
    id: 'budget_flexibility',
    type: 'chip_single',
    label: 'If we find the perfect home but it\'s over budget, how flexible are you?',
    subtitle: 'Honest answer helps us not waste your time.',
    required: false,
    options: [
      'Hard cap — I can\'t go a dollar over',
      '5–10% over for the right home',
      '10–15% stretch if it checks every box',
      'Budget is a guide, not a wall',
    ],
  },

  // Q18: Open text
  {
    id: 'open_text',
    type: 'open_text',
    label: 'Almost done! Two quick things:',
    subtitle: 'These help us understand your vibe.',
    required: false,
  },
]

/** Active questions (excluding skipped v1 placeholders) */
export const ACTIVE_QUESTIONS = INTAKE_QUESTIONS.filter((q) => !q.skipInV1)

/** Total steps for progress bar */
export const TOTAL_STEPS = ACTIVE_QUESTIONS.length

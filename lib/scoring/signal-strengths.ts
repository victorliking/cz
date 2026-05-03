/**
 * The 7-source signal hierarchy — the soul of the product.
 *
 * Every scoring function imports from this file.
 * Never hardcode signal strengths inline.
 *
 * Hierarchy (low → high):
 *   0.1  Self-report (unreliable)
 *   0.3  Forced ranking (some honesty via trade-off)
 *   0.4  Scenario answers / pain points (indirect probes)
 *   0.7  Post-showing chip selection (active reaction to specific listing)
 *   0.8  Comparative judgment A vs B (forced choice between concrete options)
 *   0.9  Agent structured observation (expert + embodied + present)
 *   1.0  Pure behavior (action without filter)
 */

export const SIGNAL_STRENGTHS = {
  /** Intake Q1-Q6: sliders, free text, basic preferences */
  INTAKE_STATED: 0.1,

  /** Intake Q7: forced ranking of 8 priorities */
  INTAKE_FORCED_RANKING: 0.3,

  /** Intake Q8-Q10: scenario answers (indirect probes) */
  INTAKE_SCENARIO: 0.4,

  /** Intake Q10: current home pain points (especially high) */
  INTAKE_PAIN_POINTS: 0.4,

  /** Post-showing: chips buyer taps (liked/disliked dimensions) */
  FEEDBACK_CHIPS: 0.7,

  /** Post-showing: gut reaction (broad, not dimension-specific) */
  FEEDBACK_GUT: 0.3,

  /** Post-showing: "compared to previous listing" A vs B */
  FEEDBACK_COMPARATIVE: 0.8,

  /** Agent structured observation after showing */
  AGENT_OBSERVATION: 0.9,

  /** Pure behavior: revisit request, budget stretch, bring partner */
  PURE_BEHAVIOR: 1.0,
} as const

export type SignalSource = keyof typeof SIGNAL_STRENGTHS

/**
 * AI-derived soft dimensions from an MLS listing description.
 *
 * The problem: ~97% of MLS listings have a rich text description but no soft
 * dimension scores (natural_light, noise_level, openness, privacy, kitchen,
 * move-in readiness, yard). With only schools + sqft to score on, every home
 * lands at ~100% and matches don't differentiate. The keyword heuristic
 * (auto-derive-vector.ts) is crude; Claude reading the actual prose infers these
 * far more accurately.
 *
 * GROUNDED + graceful: the model returns a score ONLY when the description gives
 * real evidence; otherwise it returns null for that dimension (we do NOT invent
 * a midpoint — a null dimension is simply "not assessed" downstream). If there's
 * no credential or the call fails, the whole function returns null and the
 * caller keeps whatever it had (e.g. the keyword heuristic). Presentation of the
 * scores is unchanged; this only fills gaps in the data.
 */
import { generateAI } from "@/lib/ai/anthropic-client"

export interface AIDerivedDimensions {
  natural_light: number | null
  noise_level: number | null // 5 = very quiet
  openness: number | null
  privacy: number | null
  kitchen_quality: number | null
  move_in_readiness: number | null
  yard_usability: number | null
}

const DIMS: (keyof AIDerivedDimensions)[] = [
  "natural_light", "noise_level", "openness", "privacy",
  "kitchen_quality", "move_in_readiness", "yard_usability",
]

const SYSTEM = `You extract structured 1-5 scores for a home's SOFT qualities from its listing description. Rules:
- Score ONLY dimensions the text gives real evidence for. If the description says nothing relevant, return null for that dimension — do NOT guess a middle value.
- 1-5 scale where 5 is best/most (noise_level: 5 = very quiet, 1 = very noisy).
- natural_light: sun/windows/exposure. noise_level: quiet vs busy road/neighbors. openness: open concept vs compartmentalized. privacy: lot/seclusion/distance from neighbors. kitchen_quality: finishes/appliances/renovation. move_in_readiness: renovated/turnkey vs needs work. yard_usability: usable outdoor space.
- Respond with ONLY a JSON object of {dimension: number|null}, no prose, no markdown. Example: {"natural_light":4,"noise_level":null,"openness":5,"privacy":null,"kitchen_quality":4,"move_in_readiness":5,"yard_usability":3}`

/**
 * Derive soft dimensions from a listing description via Claude. Returns null if
 * there's no usable description, no AI credential, or the call/parse fails.
 * Individual dimensions are null when the text lacks evidence for them.
 */
export async function aiDeriveVector(description: string | null | undefined): Promise<AIDerivedDimensions | null> {
  const desc = (description || "").trim()
  if (desc.length < 40) return null // too little to ground anything

  const text = await generateAI({
    system: SYSTEM,
    maxTokens: 200,
    messages: [{ role: "user", content: `Listing description:\n"""${desc.slice(0, 4000)}"""\n\nReturn the JSON scores.` }],
  })
  if (!text) return null

  // Slice the outermost JSON object and parse defensively.
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start === -1 || end === -1) return null
  let raw: Record<string, unknown>
  try { raw = JSON.parse(text.slice(start, end + 1)) } catch { return null }

  const out = {} as AIDerivedDimensions
  let any = false
  for (const d of DIMS) {
    const v = raw[d]
    if (typeof v === "number" && v >= 1 && v <= 5) { out[d] = Math.round(v); any = true }
    else out[d] = null
  }
  return any ? out : null // nothing usable extracted → treat as null
}

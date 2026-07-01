/**
 * AI-powered portrait narrative generation via Claude on AWS Bedrock.
 *
 * Architecture:
 * - Structured data (numbers, filters, weights) = deterministic (generate-portrait.ts)
 * - Narrative prose (insights, blind spots, strategy) = AI-generated (this file)
 *
 * Uses Claude Sonnet 4.6 via Bedrock (same client pattern as lib/vision/classify-style.ts).
 */

import { generateAI } from "@/lib/ai/anthropic-client"

export interface AIPortraitNarrative {
  prose: string[]
  blindSpots: string[]
  searchStrategy: string
  personalNote: string
}

/**
 * Generate AI-powered narrative for a buyer portrait.
 * Returns null if the Bedrock call fails (caller falls back to deterministic prose).
 */
export async function generateAINarrative(
  answers: Record<string, unknown>,
  locale: "en" | "zh" = "en"
): Promise<AIPortraitNarrative | null> {
  const systemPrompt = buildSystemPrompt(locale)
  const userPrompt = buildUserPrompt(answers, locale)

  // max_tokens raised to 4000: the JSON carries 3-4 prose paragraphs + blindSpots
  // + searchStrategy + personalNote, which can exceed 2000 tokens and get
  // truncated mid-object (→ unparseable JSON → silent null). 4000 gives headroom.
  const text = await generateAI({
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    maxTokens: 4000,
  })
  if (!text) return null // no credential / API failure → deterministic prose

  const parsed = parsePortraitJson(text)
  if (!parsed) {
    console.error("[AI Portrait] Could not parse model JSON — falling back to deterministic prose")
    return null
  }
  return {
    prose: Array.isArray(parsed.prose) ? parsed.prose : [],
    blindSpots: Array.isArray(parsed.blindSpots) ? parsed.blindSpots : [],
    searchStrategy: typeof parsed.searchStrategy === "string" ? parsed.searchStrategy : "",
    personalNote: typeof parsed.personalNote === "string" ? parsed.personalNote : "",
  }
}

/**
 * Robustly parse the model's JSON portrait. Strips markdown fences, slices the
 * outermost object, and — only if a direct parse fails — escapes raw control
 * characters that appear INSIDE string values (the common failure: the model
 * puts literal newlines/tabs inside prose strings, which is invalid JSON).
 * Unlike a blanket newline→\\n replace, this preserves structural whitespace, so
 * JSON.parse still sees a well-formed object. Returns null if truly unparseable.
 */
function parsePortraitJson(text: string): Record<string, any> | null {
  let s = text.trim().replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "")
  const start = s.indexOf("{")
  const end = s.lastIndexOf("}")
  if (start === -1 || end === -1 || end < start) return null
  s = s.slice(start, end + 1)

  // Attempt 1: direct parse (most well-behaved responses).
  try { return JSON.parse(s) } catch { /* fall through to repair */ }

  // Attempt 2: escape raw control chars that occur inside string literals only.
  let out = ""
  let inString = false
  let escaped = false
  for (const ch of s) {
    if (escaped) { out += ch; escaped = false; continue }
    if (ch === "\\") { out += ch; escaped = true; continue }
    if (ch === '"') { inString = !inString; out += ch; continue }
    if (inString) {
      if (ch === "\n") { out += "\\n"; continue }
      if (ch === "\r") { out += "\\r"; continue }
      if (ch === "\t") { out += "\\t"; continue }
    }
    out += ch
  }
  try { return JSON.parse(out) } catch { return null }
}

function buildSystemPrompt(locale: "en" | "zh"): string {
  const lang = locale === "zh" ? "Chinese (Simplified)" : "English"
  
  return `You are a senior real estate market analyst producing an objective consulting report for a home buyer. Your tone is neutral, data-driven, and professional — like McKinsey advising a client, not a salesperson pitching.

Core principles:
- NEUTRAL tone. No sales language. No "beautiful", "stunning", "perfect". State facts and tradeoffs.
- For each target area, objectively analyze: what matches their stated criteria, what does NOT match, and what the tradeoffs are.
- Quantify everything: commute times, price ranges, school ratings, walk scores.
- Point out contradictions between their stated preferences directly and clearly — not gently, not harshly, just factually.
- Reference specific data from their answers to justify every conclusion.
- Greater Boston market knowledge expected (actual neighborhood characteristics, price realities, school districts).

Output language: ${lang}

You MUST respond with ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "prose": ["paragraph1", "paragraph2", "paragraph3", "paragraph4"],
  "blindSpots": ["insight1", "insight2", "insight3"],
  "searchStrategy": "one paragraph describing exactly what to search for",
  "personalNote": "a short factual observation that shows analytical depth"
}

Rules for each section:
- prose: 3-4 paragraphs structured as:
  1. NEEDS SUMMARY: Based on their answers, what are the core requirements (factual restatement, no embellishment)
  2. AREA ANALYSIS: For each target area, state: fits (what matches), gaps (what doesn't), tradeoffs. Use a consistent format.
  3. BUDGET REALITY: Given their requirements vs. market, what is realistic. Include specific price ranges per area for their criteria.
  4. TIMELINE & RISK: Market conditions, competition level, what they should expect.
- blindSpots: 3-5 "decision points that need clarification" — NOT contradictions or blame. Frame each as: "here's a tradeoff in your preferences, here are your options (A/B/C)." Each should cite specific data and offer concrete actionable choices. Tone: helping them think through decisions, not pointing out mistakes.
- searchStrategy: One dense paragraph for the agent. Specific streets/neighborhoods, price bands, property criteria, and what to deprioritize.
- personalNote: One objective observation that connects dots between their answers in a way they may not have seen — insightful, not flattering.`
}

function buildUserPrompt(answers: Record<string, unknown>, locale: "en" | "zh"): string {
  const cleanAnswers = { ...answers }
  delete cleanAnswers._feedback

  const context = locale === "zh" 
    ? "This buyer filled out the questionnaire in Chinese. Generate your response in Chinese."
    : "Generate your response in English."

  return `Here are the complete questionnaire answers from a home buyer in the Greater Boston area:

${JSON.stringify(cleanAnswers, null, 2)}

${context}

Analyze deeply. Look for contradictions between priority ranking and scenario answers, hidden needs from pain points + lifestyle choices, and anything their free-text reveals that structured questions missed.

Respond with ONLY the JSON object, no other text.`
}

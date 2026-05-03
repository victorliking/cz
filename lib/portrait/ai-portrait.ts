/**
 * AI-powered portrait narrative generation via Anthropic Claude API.
 * 
 * Architecture:
 * - Structured data (numbers, filters, weights) = deterministic (generate-portrait.ts)
 * - Narrative prose (insights, blind spots, strategy) = AI-generated (this file)
 */

import Anthropic from "@anthropic-ai/sdk"

const getClient = () => {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  return new Anthropic({ apiKey })
}

export interface AIPortraitNarrative {
  prose: string[]
  blindSpots: string[]
  searchStrategy: string
  personalNote: string
}

/**
 * Generate AI-powered narrative for a buyer portrait.
 * Returns null if API key not configured or call fails.
 */
export async function generateAINarrative(
  answers: Record<string, unknown>,
  locale: "en" | "zh" = "en"
): Promise<AIPortraitNarrative | null> {
  const client = getClient()
  if (!client) return null

  const systemPrompt = buildSystemPrompt(locale)
  const userPrompt = buildUserPrompt(answers, locale)

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-20250514",
      max_tokens: 2000,
      temperature: 0.7,
      system: systemPrompt,
      messages: [
        { role: "user", content: userPrompt },
      ],
    })

    const text = response.content[0].type === "text" ? response.content[0].text : null
    if (!text) return null

    // Extract JSON from response — handle markdown wrapping and malformed JSON
    let jsonStr = text.trim()
    // Remove markdown code fences if present
    jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "")
    // Find outermost JSON object
    const start = jsonStr.indexOf("{")
    const end = jsonStr.lastIndexOf("}")
    if (start === -1 || end === -1) return null
    jsonStr = jsonStr.slice(start, end + 1)

    // Try to fix common JSON issues (unescaped newlines in strings)
    jsonStr = jsonStr.replace(/[\r\n]+/g, (match) => "\\n")
    // But re-add structural newlines between properties
    jsonStr = jsonStr.replace(/\\n\s*"/g, '\n"')
    jsonStr = jsonStr.replace(/\\n\s*}/g, '\n}')
    jsonStr = jsonStr.replace(/\\n\s*]/g, '\n]')
    jsonStr = jsonStr.replace(/\[\s*\\n/g, '[\n')
    jsonStr = jsonStr.replace(/{\s*\\n/g, '{\n')

    let parsed: any
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      // Last resort: try to evaluate the original slice
      const rawSlice = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)
      parsed = JSON.parse(rawSlice)
    }
    return {
      prose: parsed.prose || [],
      blindSpots: parsed.blindSpots || [],
      searchStrategy: parsed.searchStrategy || "",
      personalNote: parsed.personalNote || "",
    }
  } catch (error) {
    console.error("[AI Portrait] Generation failed:", error)
    return null
  }
}

function buildSystemPrompt(locale: "en" | "zh"): string {
  const lang = locale === "zh" ? "Chinese (Simplified)" : "English"
  
  return `You are a world-class real estate psychologist and buyer advisor. You analyze home buyer questionnaire responses to generate deeply personalized insights that make buyers feel truly understood.

Your output style:
- Conversational but sharp — like a brilliant friend who happens to know real estate
- Mix emotional resonance ("you want a place that feels like exhaling") with hard data ("that means south-facing, 1800+ sqft, sub-$1.2M in Arlington")
- Call out contradictions gently but clearly — buyers need to hear what they're not seeing
- Be specific to Greater Boston market knowledge when relevant
- Never be generic — every sentence should reference something specific from their answers

Output language: ${lang}

You MUST respond with ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "prose": ["paragraph1", "paragraph2", "paragraph3"],
  "blindSpots": ["insight1", "insight2", "insight3"],
  "searchStrategy": "one paragraph describing exactly what to search for",
  "personalNote": "a short 1-2 sentence note that feels deeply personal"
}

Rules for each section:
- prose: 3-4 paragraphs. First = who they are as a buyer (identity). Second = what they actually need vs what they say. Third = how their life will work in this home.
- blindSpots: 3-5 contradictions or hidden needs. Each actionable and specific. Include dollar amounts or timelines where relevant.
- searchStrategy: One dense paragraph an agent could use as a literal search brief. Include: neighborhood type, home style, must-haves, price positioning.
- personalNote: The "magic moment" — reference something specific from their free-text answers that shows you really paid attention.`
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

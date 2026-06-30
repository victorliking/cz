/**
 * AI-powered portrait narrative generation via Claude on AWS Bedrock.
 *
 * Architecture:
 * - Structured data (numbers, filters, weights) = deterministic (generate-portrait.ts)
 * - Narrative prose (insights, blind spots, strategy) = AI-generated (this file)
 *
 * Uses Claude Sonnet 4.6 via Bedrock (same client pattern as lib/vision/classify-style.ts).
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime"

const MODEL_ID = "us.anthropic.claude-sonnet-4-6"
const AWS_REGION = "us-west-2"

let _client: BedrockRuntimeClient | null = null

function getClient(): BedrockRuntimeClient {
  if (!_client) {
    _client = new BedrockRuntimeClient({ region: AWS_REGION })
  }
  return _client
}

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

  try {
    const client = getClient()

    const body = JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        { role: "user", content: userPrompt },
      ],
    })

    const command = new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: new TextEncoder().encode(body),
    })

    const response = await client.send(command)
    const responseBody = JSON.parse(new TextDecoder().decode(response.body))

    const textBlock = responseBody.content?.find(
      (block: any) => block.type === "text"
    )
    const text = textBlock?.text ?? null
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
    jsonStr = jsonStr.replace(/[\r\n]+/g, "\\n")
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

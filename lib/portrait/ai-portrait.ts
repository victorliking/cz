/**
 * AI-powered portrait narrative generation via Amazon Bedrock (Claude).
 * 
 * Architecture:
 * - Structured data (numbers, filters, weights) = deterministic (generate-portrait.ts)
 * - Narrative prose (insights, blind spots, strategy) = AI-generated (this file)
 * 
 * The AI sees ALL raw answers and generates personalized, emotionally resonant
 * text that makes the buyer feel "this system truly knows me."
 */

import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime"

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
})

const MODEL_ID = process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-5-sonnet-20241022-v2:0"

export interface AIPortraitNarrative {
  /** 3-4 paragraphs of personalized insight — emotional + analytical */
  prose: string[]
  /** 3-5 things the buyer hasn't realized about their own search */
  blindSpots: string[]
  /** One paragraph: exactly what type of home to search for */
  searchStrategy: string
  /** A personalized "note" that makes the buyer feel seen */
  personalNote: string
}

/**
 * Generate AI-powered narrative for a buyer portrait.
 * Falls back to deterministic generation if AI is unavailable.
 */
export async function generateAINarrative(
  answers: Record<string, unknown>,
  locale: "en" | "zh" = "en"
): Promise<AIPortraitNarrative | null> {
  // Skip if no credentials configured
  if (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_REGION) {
    return null
  }

  const systemPrompt = buildSystemPrompt(locale)
  const userPrompt = buildUserPrompt(answers, locale)

  try {
    const response = await client.send(
      new InvokeModelCommand({
        modelId: MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 2000,
          temperature: 0.7,
          system: systemPrompt,
          messages: [
            { role: "user", content: userPrompt },
          ],
        }),
      })
    )

    const body = JSON.parse(new TextDecoder().decode(response.body))
    const text = body.content?.[0]?.text

    if (!text) return null

    // Parse the structured JSON response
    const parsed = JSON.parse(text)
    return {
      prose: parsed.prose || [],
      blindSpots: parsed.blindSpots || [],
      searchStrategy: parsed.searchStrategy || "",
      personalNote: parsed.personalNote || "",
    }
  } catch (error) {
    console.error("[AI Portrait] Generation failed, using deterministic fallback:", error)
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

You MUST respond with valid JSON in this exact format:
{
  "prose": ["paragraph1", "paragraph2", "paragraph3"],
  "blindSpots": ["insight1", "insight2", "insight3"],
  "searchStrategy": "one paragraph describing exactly what to search for",
  "personalNote": "a short 1-2 sentence note that feels deeply personal"
}

Rules for each section:
- prose: 3-4 paragraphs. First paragraph = who they are as a buyer (identity). Second = what they actually need vs what they say. Third = how their life will work in this home. Optional fourth = something surprising.
- blindSpots: 3-5 contradictions or hidden needs they haven't articulated. Each should be actionable and specific. Include dollar amounts or timelines where relevant.
- searchStrategy: One dense paragraph that an agent could use as a literal search brief. Include: neighborhood type, home style, must-haves, price positioning, and what to skip.
- personalNote: The "magic moment" — reference something specific from their free-text answers or scenario choices that shows you really paid attention. Make it feel like the system "gets" them on a human level.`
}

function buildUserPrompt(answers: Record<string, unknown>, locale: "en" | "zh"): string {
  // Clean up answers for the prompt (remove internal fields)
  const cleanAnswers = { ...answers }
  delete cleanAnswers._feedback

  const context = locale === "zh" 
    ? "This buyer filled out the questionnaire in Chinese. Generate your response in Chinese."
    : "Generate your response in English."

  return `Here are the complete questionnaire answers from a home buyer in the Greater Boston area:

${JSON.stringify(cleanAnswers, null, 2)}

${context}

Analyze these answers deeply. Look for:
1. What their priority ranking reveals vs what their scenario answers suggest (contradictions?)
2. What their pain points + Saturday morning choices say about their actual lifestyle
3. What their budget math + timeline + flexibility suggests about urgency
4. What their home style + era + features preferences say about their aesthetic identity
5. Any free-text notes that reveal things the structured questions didn't capture

Generate the portrait narrative now. Remember: every sentence must reference specific data from their answers. No generic advice.`
}

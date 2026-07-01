/**
 * "Why this home is right for you" — grounded AI explanation for a single match card.
 *
 * PRESENTATION ONLY. This module produces prose to display on a buyer's match
 * card. It NEVER influences matching, ranking, scores, or _preferenceState. The
 * caller passes in already-computed facts (the listing's real fields, the
 * buyer's own words/priorities, and the deterministic match reasons/dimension
 * scores) and gets back a short paragraph — or null.
 *
 * Mirrors the Bedrock pattern in lib/portrait/ai-portrait.ts EXACTLY:
 * - BedrockRuntimeClient + InvokeModelCommand
 * - MODEL_ID "us.anthropic.claude-sonnet-4-6", AWS_REGION "us-west-2"
 * - body { anthropic_version: "bedrock-2023-05-31", max_tokens, system, messages }
 * - lazy getClient() singleton
 * - try/catch returns null on ANY failure (missing creds, API error, empty text)
 *
 * GROUNDING is enforced hard in the system prompt: the model may reference ONLY
 * facts present in the input. It must not invent features, amenities, prices,
 * distances, schools, or neighborhood claims. When data is thin, it says less.
 *
 * Output is PLAIN TEXT (not JSON) to keep parsing trivial: we read
 * response.content[0].text.trim().
 *
 * ─── CONTRACT (callers MUST honor) ──────────────────────────────────────────
 * generateWhyThisHome(input: WhyThisHomeInput): Promise<WhyThisHomeResult | null>
 *
 *  - Input is WhyThisHomeInput (exported below): ONLY real, already-computed data.
 *    No IDs, no _preferenceState, nothing the model could use to fabricate.
 *  - On success returns { paragraph: string } — ~2-4 sentences, warm but
 *    factual, second person ("you"), in the requested locale.
 *  - Returns null on ANY failure: missing/invalid AWS credentials, Bedrock
 *    error, timeout, empty or non-text response. This is the graceful-
 *    degradation contract — a null return is NORMAL and expected in
 *    environments without Bedrock access.
 *  - Callers MUST fall back to the EXISTING deterministic reasons (keyReasons /
 *    dimensionScores) when null is returned. NEVER surface an error or a blank
 *    card to the buyer.
 *  - This function is safe to call on-demand only (buyer expands/requests a
 *    card). Rate limiting and per-(listing, buyer-evidence) caching are the
 *    caller's (API layer's) responsibility — this lib performs no caching and
 *    is stateless apart from the lazy client singleton.
 * ────────────────────────────────────────────────────────────────────────────
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

/**
 * The listing's REAL facts, as already computed by the match engine / MLS data.
 * Optional fields are omitted (not faked) when absent so the model has less to
 * work with rather than something to embellish.
 */
export interface WhyThisHomeListing {
  address: string
  city: string
  price: number
  bedrooms: number
  bathrooms: number
  /** May be null when the caller loaded it straight from a nullable DB column. */
  sqft?: number | null
  propertyType: string
  /** May be null when the caller loaded it straight from a nullable DB column. */
  yearBuilt?: number | null
  /** May be null when the caller loaded it straight from a nullable DB column. */
  description?: string | null
  /** Deterministic "why this matches" reasons from the match engine. */
  keyReasons?: string[]
  /** Deterministic "what doesn't quite fit" concerns from the match engine. */
  concerns?: string[]
  /**
   * Per-dimension score breakdown. Accepts either the structured
   * [{ dimension, score }] form or the raw listing.vector object
   * ({ [dimension]: value }) the API layer passes through untouched.
   */
  dimensionScores?:
    | { dimension: string; score: number }[]
    | Record<string, unknown>
    | null
}

/**
 * The buyer in their OWN words + evolved priorities. Everything here is real
 * data the buyer produced (intake, showings) — never inferred by this module.
 */
export interface WhyThisHomeBuyer {
  /** Buyer archetype label, e.g. "The Nester". */
  archetype?: string
  /** The buyer's "three words" for their ideal home. */
  threeWords?: string
  /** Intake pain points / dealbreakers, in the buyer's framing. */
  painPoints?: string[]
  /** Free-text the buyer wrote (e.g. open_text notes / "anything else"). */
  openText?: string
  /**
   * Evolved priorities. Accepts either the structured [{ item, weight }] form
   * or the plain ranked string[] the API derives from the portrait / intake.
   */
  priorities?: { item: string; weight: number }[] | string[]
  /**
   * Liked/disliked phrases the buyer reacted to at prior showings. Accepts
   * plain phrases or the per-showing { address, liked, disliked } form.
   */
  recentReactions?:
    | string[]
    | { address?: string; liked?: string; disliked?: string }[]
}

/**
 * The complete, grounded input shared by the API/UI and this lib.
 * Contains ONLY facts — no matching internals, no preference state, no IDs.
 */
export interface WhyThisHomeInput {
  listing: WhyThisHomeListing
  buyer: WhyThisHomeBuyer
  locale?: "en" | "zh"
}

/** Successful result: a short, grounded paragraph to display on the card. */
export interface WhyThisHomeResult {
  paragraph: string
}

/**
 * Generate a grounded "why this home is right for you" paragraph for ONE match.
 *
 * Returns null on ANY failure — the caller MUST fall back to the existing
 * deterministic reasons. See the CONTRACT block at the top of this file.
 */
export async function generateWhyThisHome(
  input: WhyThisHomeInput
): Promise<WhyThisHomeResult | null> {
  const locale = input.locale ?? "en"
  const systemPrompt = buildSystemPrompt(locale)
  const userPrompt = buildUserPrompt(input)

  try {
    const client = getClient()

    const body = JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
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
    const text: string | undefined = textBlock?.text?.trim()
    if (!text) return null

    return { paragraph: text }
  } catch (error) {
    console.error("[Why This Home] Generation failed:", error)
    return null
  }
}

function buildSystemPrompt(locale: "en" | "zh"): string {
  const lang = locale === "zh" ? "Chinese (Simplified)" : "English"

  return `You explain why ONE home fits THIS buyer. Use ONLY the facts provided — the listing fields and the buyer's own words/priorities. NEVER invent features, amenities, prices, distances, schools, or neighborhood claims not in the data. Connect the home's real attributes to the buyer's stated pain points, their three words, and what they've reacted to at showings. If the data is thin, say less — do not embellish. No sales language ('stunning','perfect','dream'). 2-4 sentences, address the buyer as 'you'.

More rules:
- Ground every clause in a specific fact from the input. If you cannot tie a statement to a provided fact, omit it.
- Prefer the buyer's OWN words and priorities over generic description. Echo their three words or a pain point when a real listing fact addresses it.
- Do not restate the price or raw numbers as a pitch; reference them only when they answer something the buyer cares about.
- Do not claim the home is a match "because our system says so" and do not mention scores, dimensions, weights, or algorithms — translate them into plain, human reasons.
- If a concern is provided, you may acknowledge it honestly, but the paragraph's focus is the genuine fit. Never contradict a concern by pretending it isn't there.
- Warm and personal in tone, but factual. No exclamation marks. No hype adjectives.
- Output PLAIN TEXT only: a single short paragraph of 2-4 sentences. No headings, no lists, no JSON, no quotation marks around the whole thing.

Output language: ${lang}. Address the buyer directly as "you" (in Chinese, use 您).`
}

function buildUserPrompt(input: WhyThisHomeInput): string {
  const { listing, buyer, locale = "en" } = input

  // Assemble only the facts that are actually present. Omitting absent fields
  // (rather than sending nulls) reduces the surface the model could embellish.
  const listingFacts: Record<string, unknown> = {
    address: listing.address,
    city: listing.city,
    price: listing.price,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    propertyType: listing.propertyType,
  }
  if (listing.sqft != null) listingFacts.sqft = listing.sqft
  if (listing.yearBuilt != null) listingFacts.yearBuilt = listing.yearBuilt
  if (listing.description) listingFacts.description = listing.description
  if (listing.keyReasons?.length) listingFacts.whyItMatches = listing.keyReasons
  if (listing.concerns?.length) listingFacts.concerns = listing.concerns
  // dimensionScores may arrive as a structured array OR the raw listing.vector
  // object. Only include it when it actually carries something.
  if (Array.isArray(listing.dimensionScores)) {
    if (listing.dimensionScores.length) {
      listingFacts.dimensionScores = listing.dimensionScores
    }
  } else if (
    listing.dimensionScores &&
    typeof listing.dimensionScores === "object" &&
    Object.keys(listing.dimensionScores).length
  ) {
    listingFacts.dimensionScores = listing.dimensionScores
  }

  const buyerFacts: Record<string, unknown> = {}
  if (buyer.archetype) buyerFacts.archetype = buyer.archetype
  if (buyer.threeWords) buyerFacts.threeWords = buyer.threeWords
  if (buyer.painPoints?.length) buyerFacts.painPoints = buyer.painPoints
  if (buyer.openText) buyerFacts.openText = buyer.openText
  if (buyer.priorities?.length) buyerFacts.priorities = buyer.priorities
  if (buyer.recentReactions?.length) {
    buyerFacts.reactionsAtShowings = buyer.recentReactions
  }

  const context =
    locale === "zh"
      ? "Respond in Chinese (Simplified)."
      : "Respond in English."

  return `Here are the ONLY facts you may use. Do not add anything not present here.

LISTING (the home's real attributes and the deterministic match analysis):
${JSON.stringify(listingFacts, null, 2)}

BUYER (their own words, priorities, and how they reacted at showings):
${JSON.stringify(buyerFacts, null, 2)}

Write a single grounded paragraph (2-4 sentences) explaining why THIS home fits THIS buyer, tying real listing attributes to the buyer's stated pain points, their three words, their priorities, and what they reacted to at showings. Address the buyer as "you". ${context}

Respond with ONLY the paragraph text — no preamble, no labels, no quotes.`
}

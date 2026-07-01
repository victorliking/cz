/**
 * Provider-agnostic AI text generation for all AI features (portrait narrative,
 * photo style classification, "why this home").
 *
 * Routes to whichever Claude credential is available, preferring the funded
 * path:
 *   1. AWS Bedrock  — when AWS_BEARER_TOKEN_BEDROCK or AWS_ACCESS_KEY_ID is set
 *      (Claude Sonnet 4.6 via the inference profile, us-west-2).
 *   2. Anthropic API — when ANTHROPIC_API_KEY is set (Claude Sonnet 4.6 direct).
 *   3. Neither → returns null, and every caller degrades to the deterministic
 *      path, so the app never breaks when no credential is present.
 *
 * The Bedrock InvokeModel body IS the Anthropic Messages shape (plus
 * anthropic_version), so callers pass ONE `messages` array (text or multimodal)
 * and it works on both providers.
 *
 * Model: Sonnet 4.6 — the deliberate cost/quality choice for short grounded
 * prose ($3/$15 per MTok vs Opus $5/$25); these tasks are a few hundred tokens
 * of factual text, so Opus would add cost without benefit.
 */
import Anthropic from "@anthropic-ai/sdk"
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime"

export const AI_MODEL = "claude-sonnet-4-6"
const BEDROCK_MODEL = "us.anthropic.claude-sonnet-4-6"
const AWS_REGION = process.env.AWS_REGION || "us-west-2"

export type AiMessage = { role: "user" | "assistant"; content: unknown }

/** True when a Bedrock credential is available (bearer token or AWS creds). */
function hasBedrock(): boolean {
  return !!(process.env.AWS_BEARER_TOKEN_BEDROCK || process.env.AWS_ACCESS_KEY_ID)
}

let _bedrock: BedrockRuntimeClient | null = null
let _anthropic: Anthropic | null = null

/**
 * Generate text from Claude. Returns the concatenated text, or null on ANY
 * failure / missing credential (the graceful-degradation contract every caller
 * relies on). `messages` uses the Anthropic Messages content shape.
 */
export async function generateAI(opts: {
  system?: string
  messages: AiMessage[]
  maxTokens: number
}): Promise<string | null> {
  // --- Preferred: AWS Bedrock (the funded path) ---
  if (hasBedrock()) {
    try {
      if (!_bedrock) _bedrock = new BedrockRuntimeClient({ region: AWS_REGION })
      const body = JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: opts.maxTokens,
        ...(opts.system ? { system: opts.system } : {}),
        messages: opts.messages,
      })
      const res = await _bedrock.send(
        new InvokeModelCommand({
          modelId: BEDROCK_MODEL,
          contentType: "application/json",
          accept: "application/json",
          body: new TextEncoder().encode(body),
        })
      )
      const out = JSON.parse(new TextDecoder().decode(res.body))
      const text: string | undefined = out.content
        ?.find((b: { type?: string }) => b.type === "text")
        ?.text?.trim()
      return text || null
    } catch (error) {
      console.error("[AI/Bedrock] generation failed:", error)
      return null
    }
  }

  // --- Fallback: Anthropic API (direct) ---
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  try {
    if (!_anthropic) _anthropic = new Anthropic({ apiKey })
    const resp = await _anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: opts.maxTokens,
      ...(opts.system ? { system: opts.system } : {}),
      // Callers pass the Anthropic Messages content shape verbatim.
      messages: opts.messages as Anthropic.MessageParam[],
    })
    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()
    return text || null
  } catch (error) {
    console.error("[AI/Anthropic] generation failed:", error)
    return null
  }
}

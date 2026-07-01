/**
 * Shared Anthropic SDK client for all AI features (portrait narrative, photo
 * style classification, "why this home").
 *
 * We use the direct Anthropic API (ANTHROPIC_API_KEY) rather than AWS Bedrock:
 * simpler credential story (a single sk-ant-… key, no AWS account/IAM), and it
 * uses the API key already provisioned in the environment.
 *
 * Model: Claude Sonnet 4.6 — the deliberate cost/quality choice for the short,
 * grounded prose these features produce. Sonnet is fast and inexpensive
 * ($3/$15 per MTok) vs. Opus ($5/$25); the tasks are constrained (a few hundred
 * tokens of factual text), so Opus would add cost without meaningful benefit.
 *
 * getAnthropic() returns null when ANTHROPIC_API_KEY is unset — every caller
 * treats null as "degrade gracefully to the deterministic path", so the app
 * never breaks when the key is absent.
 */
import Anthropic from "@anthropic-ai/sdk"

/** Shared model id for all AI features (see cost/quality note above). */
export const AI_MODEL = "claude-sonnet-4-6"

let _client: Anthropic | null = null

export function getAnthropic(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  if (!_client) {
    _client = new Anthropic({ apiKey })
  }
  return _client
}

/**
 * Extract the concatenated text from a Messages API response, or null if there
 * is no text block. Keeps callers from repeating the content-block dance.
 */
export function extractText(message: Anthropic.Message): string | null {
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim()
  return text.length > 0 ? text : null
}

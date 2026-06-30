/**
 * Stateless, signed, expiring intake link tokens.
 *
 * Tokens are HMAC-SHA256 signatures over `${profileId}.${expiresAt}` keyed by
 * INTAKE_TOKEN_SECRET. They require ZERO database state — verification is pure
 * crypto, so they work across serverless invocations without coordination.
 *
 * Token format: `${expiresAt}.${signatureHex}` (base64url-safe, dot-delimited).
 *
 * Security posture: fail-closed. If INTAKE_TOKEN_SECRET is unset we refuse to
 * mint OR verify tokens (verification returns false), so public intake routes
 * cannot be hit without the secret being configured. In local dev a clear
 * console warning is emitted so the app still boots.
 */

import { createHmac, timingSafeEqual } from "node:crypto"

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 14 // 14 days

function getSecret(): string | null {
  const secret = process.env.INTAKE_TOKEN_SECRET
  if (!secret) {
    console.warn(
      "[intake-token] INTAKE_TOKEN_SECRET is not set — intake links will fail closed (no tokens minted or verified)."
    )
    return null
  }
  return secret
}

function sign(profileId: string, expiresAt: number, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${profileId}.${expiresAt}`)
    .digest("hex")
}

/**
 * Create a signed token bound to `profileId` that expires after `ttlMs`.
 * Returns an empty string if the secret is missing (caller should treat the
 * link as unprotected and surface the misconfiguration).
 */
export function createIntakeToken(
  profileId: string,
  ttlMs: number = DEFAULT_TTL_MS
): string {
  const secret = getSecret()
  if (!secret) return ""

  const expiresAt = Date.now() + ttlMs
  const signature = sign(profileId, expiresAt, secret)
  return `${expiresAt}.${signature}`
}

/**
 * Verify that `token` is a valid, unexpired signature for `profileId`.
 * Fail-closed: returns false on missing secret, malformed token, bad
 * signature, or expiry.
 */
export function verifyIntakeToken(profileId: string, token: string | null | undefined): boolean {
  const secret = getSecret()
  if (!secret) return false
  if (!token || typeof token !== "string") return false

  const dot = token.indexOf(".")
  if (dot <= 0) return false

  const expiresPart = token.slice(0, dot)
  const signaturePart = token.slice(dot + 1)

  const expiresAt = Number(expiresPart)
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return false
  if (Date.now() > expiresAt) return false

  const expected = sign(profileId, expiresAt, secret)

  // Constant-time comparison; lengths must match for timingSafeEqual.
  const a = Buffer.from(signaturePart, "hex")
  const b = Buffer.from(expected, "hex")
  if (a.length !== b.length || a.length === 0) return false

  return timingSafeEqual(a, b)
}

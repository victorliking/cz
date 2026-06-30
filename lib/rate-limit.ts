/**
 * Minimal, dependency-free in-memory fixed-window rate limiter.
 *
 * Keyed by IP + route. State lives in a module-level Map, so it is per-instance
 * (good enough for abuse mitigation on a single serverless instance / dev box;
 * a distributed limiter, e.g. Upstash, is the enterprise follow-up). Counters
 * are lazily expired on read, and a periodic sweep bounds memory growth.
 */

interface WindowState {
  count: number
  resetAt: number // epoch ms when the current window ends
}

const buckets = new Map<string, WindowState>()

// Bound memory: opportunistically sweep expired buckets.
let lastSweep = Date.now()
const SWEEP_INTERVAL_MS = 60_000

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return
  lastSweep = now
  for (const [key, state] of buckets) {
    if (state.resetAt <= now) buckets.delete(key)
  }
}

export interface RateLimitResult {
  allowed: boolean
  /** Seconds until the window resets (for the Retry-After header). */
  retryAfter: number
  remaining: number
}

export interface RateLimitOptions {
  /** Max requests allowed per window. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
}

/**
 * Record a hit for `key` and report whether it is allowed under the window.
 * `key` should encode both the client identity (IP) and the route.
 */
export function rateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const { limit, windowMs } = options
  const now = Date.now()
  sweep(now)

  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfter: 0, remaining: Math.max(0, limit - 1) }
  }

  existing.count += 1

  if (existing.count > limit) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      remaining: 0,
    }
  }

  return {
    allowed: true,
    retryAfter: 0,
    remaining: Math.max(0, limit - existing.count),
  }
}

/**
 * Best-effort client IP extraction from standard proxy headers
 * (Vercel / typical reverse proxies). Falls back to a constant so the
 * limiter still functions (shared bucket) when no IP is available.
 */
export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for")
  if (xff) {
    const first = xff.split(",")[0]?.trim()
    if (first) return first
  }
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  )
}

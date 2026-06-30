import { describe, it, expect } from "vitest"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

/**
 * Unit tests for the in-memory fixed-window rate limiter.
 *
 * The limiter keys state in a module-level Map, so tests use unique keys
 * (suffixed per-test) to avoid cross-test contamination. Windows are kept
 * tiny (30-50ms) so the reset test stays fast; real timers are available
 * here (this is vitest's node environment, not the workflow sandbox).
 */
describe("rateLimit", () => {
  it("allows requests up to the limit within the window", () => {
    const key = "test:allow-up-to-limit"
    const opts = { limit: 3, windowMs: 1000 }

    const r1 = rateLimit(key, opts)
    expect(r1.allowed).toBe(true)
    expect(r1.remaining).toBe(2)

    const r2 = rateLimit(key, opts)
    expect(r2.allowed).toBe(true)
    expect(r2.remaining).toBe(1)

    const r3 = rateLimit(key, opts)
    expect(r3.allowed).toBe(true)
    expect(r3.remaining).toBe(0)
  })

  it("blocks the (limit+1)th request with allowed:false and retryAfter > 0", () => {
    const key = "test:block-over-limit"
    const opts = { limit: 2, windowMs: 1000 }

    expect(rateLimit(key, opts).allowed).toBe(true)
    expect(rateLimit(key, opts).allowed).toBe(true)

    const blocked = rateLimit(key, opts)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfter).toBeGreaterThan(0)
    expect(blocked.remaining).toBe(0)
  })

  it("resets after the window elapses", async () => {
    const key = "test:reset-after-window"
    const windowMs = 30
    const opts = { limit: 1, windowMs }

    expect(rateLimit(key, opts).allowed).toBe(true)
    expect(rateLimit(key, opts).allowed).toBe(false)

    // Wait for the window to lapse, then the bucket should be fresh again.
    await new Promise((r) => setTimeout(r, windowMs + 5))

    const afterReset = rateLimit(key, opts)
    expect(afterReset.allowed).toBe(true)
    expect(afterReset.remaining).toBe(0)
  })

  it("keeps independent buckets for distinct keys", () => {
    const opts = { limit: 1, windowMs: 1000 }

    const a = rateLimit("test:distinct:a", opts)
    const b = rateLimit("test:distinct:b", opts)

    // Each key consumes its own bucket; neither blocks the other.
    expect(a.allowed).toBe(true)
    expect(b.allowed).toBe(true)

    // The second hit on the same key is blocked, proving buckets are per-key.
    expect(rateLimit("test:distinct:a", opts).allowed).toBe(false)
    expect(rateLimit("test:distinct:b", opts).allowed).toBe(false)
  })
})

describe("getClientIp", () => {
  it("parses the first IP from x-forwarded-for", () => {
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" },
    })
    expect(getClientIp(request)).toBe("203.0.113.7")
  })

  it("trims whitespace around the first x-forwarded-for IP", () => {
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "  198.51.100.4  , 70.41.3.18" },
    })
    expect(getClientIp(request)).toBe("198.51.100.4")
  })

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const request = new Request("https://example.com", {
      headers: { "x-real-ip": "192.0.2.55" },
    })
    expect(getClientIp(request)).toBe("192.0.2.55")
  })

  it("falls back to cf-connecting-ip", () => {
    const request = new Request("https://example.com", {
      headers: { "cf-connecting-ip": "192.0.2.99" },
    })
    expect(getClientIp(request)).toBe("192.0.2.99")
  })

  it("falls back to 'unknown' when no IP headers are present", () => {
    const request = new Request("https://example.com")
    expect(getClientIp(request)).toBe("unknown")
  })
})

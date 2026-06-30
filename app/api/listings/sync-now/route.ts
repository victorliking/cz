/**
 * Agent-triggered "Sync now" — an authenticated, allowlisted way to fire the
 * MLS sync on demand and SEE the result, without exposing CRON_SECRET.
 *
 * This is how an agent verifies the MLS PIN download leg works (the scheduled
 * cron runs headless). It calls the cron handler internally with the server's
 * own CRON_SECRET and withdraw=0 (test-safe: never withdraws inventory on a
 * manual run), and returns the sync summary to the caller.
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getApiUser } from "@/lib/auth"
import { rateLimit, getClientIp } from "@/lib/rate-limit"
import { GET as runSync } from "@/app/api/cron/sync-mls/route"

export async function POST(request: NextRequest) {
  const apiUser = await getApiUser(request)
  if (!apiUser?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  // Only an allowlisted AGENT may trigger a sync (it hits the paid MLS feed +
  // writes the shared inventory). Mirrors the AGENT_ALLOWLIST gate on set-role.
  const user = await prisma.user.findUnique({
    where: { id: apiUser.id },
    select: { email: true, role: true },
  })
  const allowlist = (process.env.AGENT_ALLOWLIST || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  const email = user?.email?.toLowerCase()
  if (user?.role !== "AGENT" || !email || !allowlist.includes(email)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 })
  }

  // Tight rate limit — this is expensive (downloads + parses thousands of rows).
  const rl = rateLimit(`sync-now:${apiUser.id}`, { limit: 3, windowMs: 300_000 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Sync was triggered recently — please wait before retrying." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    )
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured on the server" },
      { status: 500 }
    )
  }

  // Build the internal request the cron handler expects: Bearer CRON_SECRET +
  // withdraw=0 (manual runs never withdraw inventory — that's the scheduled
  // job's responsibility, and only when it pulls a believable record count).
  const url = new URL("/api/cron/sync-mls?withdraw=0", request.nextUrl.origin)
  const internalReq = new NextRequest(url, {
    headers: { authorization: `Bearer ${cronSecret}` },
  })

  try {
    const res = await runSync(internalReq)
    const body = await res.json()
    // Surface the cron's own status (e.g. 500 "credentials not configured")
    // so the agent sees exactly why a sync didn't run.
    return NextResponse.json(
      { triggeredBy: email, ...body },
      { status: res.status }
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

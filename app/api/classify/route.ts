/**
 * Style Classification API Route
 *
 * Classifies a listing's exterior photo using AI vision and stores
 * the resulting style tags in the listing's vector JSON.
 *
 * Authentication: CRON_SECRET (for batch jobs) OR authenticated user with AGENT role.
 *
 * Usage:
 *   POST /api/classify
 *   Body: { listingId: string }
 *   Headers: Authorization: Bearer <CRON_SECRET> (for cron/batch)
 *            — or — session cookie (for authenticated agent)
 */

import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getApiUser } from "@/lib/auth"
import { classifyStyle } from "@/lib/vision/classify-style"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  // --- Auth: CRON_SECRET or authenticated AGENT ---
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  let authorized = false
  let userId: string | undefined

  // Check CRON_SECRET
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    authorized = true
  }

  // Check authenticated user
  if (!authorized) {
    const user = await getApiUser(request)
    if (user && (user.role === "AGENT" || user.role === "ADMIN")) {
      authorized = true
      userId = user.id
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rl = rateLimit(`classify:${userId ?? getClientIp(request)}`, {
    limit: 15,
    windowMs: 60_000,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    )
  }

  // --- Parse body ---
  let body: { listingId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  const { listingId } = body
  if (!listingId) {
    return NextResponse.json(
      { error: "listingId is required" },
      { status: 400 }
    )
  }

  // --- Fetch listing ---
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, photos: true, vector: true },
  })

  if (!listing) {
    return NextResponse.json(
      { error: "Listing not found" },
      { status: 404 }
    )
  }

  // --- Get photo URL ---
  const photos = listing.photos as string[] | null
  if (!photos || photos.length === 0) {
    return NextResponse.json(
      { error: "Listing has no photos" },
      { status: 422 }
    )
  }

  const photoUrl = photos[0]

  // --- Classify ---
  const classification = await classifyStyle(photoUrl)

  if (!classification) {
    return NextResponse.json(
      { error: "Classification failed — photo may be unavailable or unrecognizable" },
      { status: 422 }
    )
  }

  // --- Update vector with style_tags ---
  const currentVector = (listing.vector as Record<string, unknown>) || {}
  const updatedVector = {
    ...currentVector,
    style_tags: classification,
  } as unknown as Prisma.InputJsonValue

  await prisma.listing.update({
    where: { id: listingId },
    data: { vector: updatedVector },
  })

  return NextResponse.json({
    success: true,
    listingId,
    style_tags: classification,
  })
}

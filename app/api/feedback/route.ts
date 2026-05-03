import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export interface ShowingFeedbackEntry {
  id: string
  address: string
  date: string
  liked: string
  disliked: string
  verdict: "love" | "like" | "neutral" | "dislike"
  notes: string
  adjustments: string
}

// GET: Retrieve feedback from buyer profile's JSON field
export async function GET(request: NextRequest) {
  const userId = request.cookies.get("homematch_user")?.value
  if (!userId) return NextResponse.json({ entries: [] })

  const profile = await prisma.buyerProfile.findFirst({
    where: { userId },
  })
  if (!profile) return NextResponse.json({ entries: [] })

  // Store feedback in the profile's JSON answers field under _feedback key
  const answers = (profile.answers as Record<string, unknown>) || {}
  const entries = (answers._feedback || []) as ShowingFeedbackEntry[]

  return NextResponse.json({ entries })
}

// POST: Add new showing feedback
export async function POST(request: NextRequest) {
  const userId = request.cookies.get("homematch_user")?.value
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const profile = await prisma.buyerProfile.findFirst({
    where: { userId },
  })
  if (!profile) {
    return NextResponse.json({ error: "No profile" }, { status: 404 })
  }

  const body = await request.json()
  const { address, liked, disliked, verdict, notes, adjustments } = body

  const entry: ShowingFeedbackEntry = {
    id: `fb_${Date.now()}`,
    address: address || "",
    date: new Date().toISOString().split("T")[0],
    liked: liked || "",
    disliked: disliked || "",
    verdict: verdict || "neutral",
    notes: notes || "",
    adjustments: adjustments || "",
  }

  // Append to existing feedback array in answers JSON
  const answers = (profile.answers as Record<string, unknown>) || {}
  const existing = (answers._feedback || []) as ShowingFeedbackEntry[]
  existing.unshift(entry)

  await prisma.buyerProfile.update({
    where: { id: profile.id },
    data: {
      answers: { ...answers, _feedback: existing },
    },
  })

  return NextResponse.json({ entry })
}

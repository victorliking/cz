import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generatePortrait } from "@/lib/portrait/generate-portrait"
import { generateAINarrative } from "@/lib/portrait/ai-portrait"
import { getApiUser } from "@/lib/auth"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

export async function GET(request: NextRequest) {
  const apiUser = await getApiUser(request)
  const userId = apiUser?.id
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const rl = rateLimit(`portrait:${userId ?? getClientIp(request)}`, {
    limit: 10,
    windowMs: 60_000,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    )
  }

  const profile = await prisma.buyerProfile.findFirst({
    where: { userId },
    include: { intakeResponse: true },
  })

  if (!profile?.intakeResponse?.answers) {
    return NextResponse.json({ portrait: null })
  }

  const answers = profile.intakeResponse.answers as Record<string, any>
  
  // Step 1: Generate deterministic structured data (always works, instant)
  const portrait = generatePortrait(answers)

  // Step 2: Try AI narrative generation (emotional + personalized prose)
  // Falls back gracefully to deterministic prose if AI unavailable
  const locale = (request.headers.get("accept-language")?.includes("zh") ? "zh" : "en") as "en" | "zh"
  
  try {
    const aiNarrative = await generateAINarrative(answers, locale)
    
    if (aiNarrative) {
      // AI-generated prose overrides deterministic prose
      portrait.prose = aiNarrative.prose
      portrait.blindSpots = aiNarrative.blindSpots
      portrait.searchStrategy = aiNarrative.searchStrategy
      // Add personal note as an extra field
      ;(portrait as any).personalNote = aiNarrative.personalNote
    }
  } catch (e) {
    // AI failed — deterministic portrait still works perfectly
    console.log("[Portrait API] AI narrative unavailable, using deterministic fallback")
  }

  return NextResponse.json({ portrait })
}

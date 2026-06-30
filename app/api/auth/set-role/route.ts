import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request })
  if (!token?.sub) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { role } = await request.json()
  if (role !== "BUYER" && role !== "AGENT") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }

  // Role escalation gate: anyone may self-assign BUYER, but AGENT requires the
  // user's email to be on the (comma-separated) AGENT_ALLOWLIST env var.
  if (role === "AGENT") {
    const user = await prisma.user.findUnique({
      where: { id: token.sub },
      select: { email: true },
    })

    const allowlist = (process.env.AGENT_ALLOWLIST || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)

    const email = user?.email?.toLowerCase()

    if (allowlist.length === 0) {
      console.warn(
        "[set-role] AGENT_ALLOWLIST is not set — refusing all AGENT escalations (fail closed)."
      )
    }

    if (!email || !allowlist.includes(email)) {
      return NextResponse.json(
        { error: "Not authorized to become an agent" },
        { status: 403 }
      )
    }
  }

  await prisma.user.update({
    where: { id: token.sub },
    data: { role },
  })

  // If buyer, create a buyer profile (self-managed for now)
  if (role === "BUYER") {
    const existing = await prisma.buyerProfile.findFirst({
      where: { userId: token.sub },
    })
    if (!existing) {
      await prisma.buyerProfile.create({
        data: {
          userId: token.sub,
          agentId: token.sub,
        },
      })
    }
  }

  return NextResponse.json({ success: true })
}

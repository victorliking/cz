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

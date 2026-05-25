import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getApiUser } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const apiUser = await getApiUser(request)
  if (!apiUser?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const buyers = await prisma.buyerProfile.findMany({
    where: { agentId: apiUser.id },
    include: { user: true, intakeResponse: true },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({
    buyers: buyers.map((b) => ({
      id: b.id,
      status: b.status,
      intakeCompletedAt: b.intakeCompletedAt,
      notes: b.notes,
      user: { name: b.user.name, email: b.user.email, phone: b.user.phone },
      intakeResponse: b.intakeResponse
        ? { completedAt: b.intakeResponse.completedAt }
        : null,
    })),
  })
}

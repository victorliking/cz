import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getApiUser } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const apiUser = await getApiUser(request)
  if (!apiUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const showingId = request.nextUrl.searchParams.get("showingId")
  if (!showingId) {
    return NextResponse.json({ error: "showingId required" }, { status: 400 })
  }

  const showing = await prisma.showing.findUnique({
    where: { id: showingId },
    include: {
      buyerProfile: { include: { user: { select: { name: true, email: true } } } },
      listing: { select: { address: true, city: true, state: true } },
    },
  })

  if (!showing || showing.buyerProfile.agentId !== apiUser.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({
    buyerName: showing.buyerProfile.user.name || showing.buyerProfile.user.email || "Buyer",
    listingAddress: `${showing.listing.address}, ${showing.listing.city}, ${showing.listing.state}`,
  })
}

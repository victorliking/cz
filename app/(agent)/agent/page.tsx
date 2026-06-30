import { prisma } from "@/lib/prisma"
import { getServerUserId } from "@/lib/auth"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const dynamic = "force-dynamic"

export default async function AgentDashboard() {
  // Canonical id — matches getApiUser().id used by the buyers/listings list APIs.
  const userId = await getServerUserId()

  if (!userId) return <p>Not authenticated</p>

  const [listings, activeBuyers, insights] = await Promise.all([
    // Count the SAME working set the /agent/listings page shows: the agent's own
    // inventory plus shared MLS inventory owned by any AGENT-role user. Counting
    // only `agentId: userId` here would show "0" on the dashboard while the
    // listings page (one click away) shows hundreds — a confusing mismatch.
    prisma.listing.count({
      where: {
        status: "ACTIVE",
        OR: [{ agentId: userId }, { agent: { role: "AGENT" } }],
      },
    }),
    prisma.buyerProfile.count({ where: { agentId: userId, status: "ACTIVE" } }),
    prisma.insightLog.count({
      where: { dismissedAt: null, buyerProfile: { agentId: userId } },
    }),
  ])

  return (
    <div className="p-10 max-w-4xl">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">Dashboard</h1>
        <p className="text-[#86868b] mt-2">Welcome back. Here&apos;s your overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
        <Card className="shadow-sm border-0 bg-white rounded-2xl">
          <CardHeader className="pb-2 pt-8 px-8">
            <CardTitle className="text-sm font-normal text-[#86868b]">Listings</CardTitle>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <p className="text-4xl font-semibold text-[#1d1d1f] tracking-tight">{listings}</p>
            <p className="text-sm text-[#86868b] mt-1">Active properties</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-0 bg-white rounded-2xl">
          <CardHeader className="pb-2 pt-8 px-8">
            <CardTitle className="text-sm font-normal text-[#86868b]">Active Buyers</CardTitle>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <p className="text-4xl font-semibold text-[#1d1d1f] tracking-tight">{activeBuyers}</p>
            <p className="text-sm text-[#86868b] mt-1">Currently searching</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-0 bg-white rounded-2xl">
          <CardHeader className="pb-2 pt-8 px-8">
            <CardTitle className="text-sm font-normal text-[#86868b]">Insights</CardTitle>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <p className="text-4xl font-semibold text-[#1d1d1f] tracking-tight">{insights}</p>
            <p className="text-sm text-[#86868b] mt-1">Pending review</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        <Link href="/agent/buyers">
          <Button className="h-12 px-8 rounded-xl bg-[#1d1d1f] hover:bg-[#333336] text-white text-sm font-medium transition-all">View Buyers</Button>
        </Link>
        <Link href="/agent/listings">
          <Button variant="outline" className="h-12 px-8 rounded-xl border-slate-100 text-[#1d1d1f] hover:bg-[#f5f5f7] text-sm font-medium transition-all">View Listings</Button>
        </Link>
        <Link href="/agent/listings/new">
          <Button variant="outline" className="h-12 px-8 rounded-xl border-slate-100 text-[#1d1d1f] hover:bg-[#f5f5f7] text-sm font-medium transition-all">New Listing</Button>
        </Link>
      </div>
    </div>
  )
}

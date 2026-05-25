import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const dynamic = "force-dynamic"

export default async function AgentDashboard() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id

  if (!userId) return <p>Not authenticated</p>

  const [listings, buyers] = await Promise.all([
    prisma.listing.count({ where: { agentId: userId } }),
    prisma.buyerProfile.count({ where: { agentId: userId } }),
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
            <p className="text-4xl font-semibold text-[#1d1d1f] tracking-tight">{buyers}</p>
            <p className="text-sm text-[#86868b] mt-1">Currently searching</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-0 bg-white rounded-2xl">
          <CardHeader className="pb-2 pt-8 px-8">
            <CardTitle className="text-sm font-normal text-[#86868b]">Insights</CardTitle>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <p className="text-4xl font-semibold text-[#1d1d1f] tracking-tight">0</p>
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

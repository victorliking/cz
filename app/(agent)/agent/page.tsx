import { prisma } from "@/lib/prisma"
import { cookies } from "next/headers"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const dynamic = "force-dynamic"

export default async function AgentDashboard() {
  const cookieStore = cookies()
  const userId = cookieStore.get("homematch_user")?.value

  if (!userId) return <p>Not authenticated</p>

  const [listings, buyers] = await Promise.all([
    prisma.listing.count({ where: { agentId: userId } }),
    prisma.buyerProfile.count({ where: { agentId: userId } }),
  ])

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Welcome back. Here&apos;s your overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Listings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-slate-900">{listings}</p>
            <p className="text-xs text-slate-400 mt-1">Active properties</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Active Buyers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-slate-900">{buyers}</p>
            <p className="text-xs text-slate-400 mt-1">Currently searching</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-slate-900">0</p>
            <p className="text-xs text-slate-400 mt-1">Pending review</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Link href="/agent/buyers">
          <Button size="lg">View Buyers</Button>
        </Link>
        <Link href="/agent/listings">
          <Button variant="outline" size="lg">View Listings</Button>
        </Link>
        <Link href="/agent/listings/new">
          <Button variant="outline" size="lg">+ New Listing</Button>
        </Link>
      </div>
    </div>
  )
}

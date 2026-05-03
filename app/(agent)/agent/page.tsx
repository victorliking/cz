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
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-6">Agent Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Listings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{listings}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Active Buyers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{buyers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">0</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Link href="/agent/listings">
          <Button>View Listings</Button>
        </Link>
        <Link href="/agent/listings/new">
          <Button variant="outline">+ New Listing</Button>
        </Link>
      </div>
    </main>
  )
}

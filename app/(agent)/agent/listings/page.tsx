import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

export default async function ListingsPage() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id

  if (!userId) {
    return <p>Not authenticated</p>
  }

  const listings = await prisma.listing.findMany({
    where: { agentId: userId },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Listings</h1>
          <p className="text-slate-500 mt-1">{listings.length} properties</p>
        </div>
        <Link href="/agent/listings/new">
          <Button size="lg">+ New Listing</Button>
        </Link>
      </div>

      {listings.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <p className="text-slate-400 text-lg">No listings yet.</p>
          <Link href="/agent/listings/new" className="text-blue-600 hover:text-blue-700 underline mt-2 inline-block">
            Create your first listing →
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {listings.map((listing) => (
            <Link
              key={listing.id}
              href={`/agent/listings/${listing.id}`}
              className="block bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{listing.address}</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {listing.city}, {listing.state} {listing.zipCode}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900 text-lg">${listing.listPrice.toLocaleString()}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-slate-500">
                      {listing.bedrooms} bed · {listing.bathroomsFull} bath
                    </span>
                    <Badge variant={listing.status === "ACTIVE" ? "default" : "secondary"} className="text-xs">
                      {listing.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

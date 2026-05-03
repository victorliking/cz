import { prisma } from "@/lib/prisma"
import { cookies } from "next/headers"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

export default async function ListingsPage() {
  const cookieStore = cookies()
  const userId = cookieStore.get("homematch_user")?.value

  if (!userId) {
    return <p>Not authenticated</p>
  }

  const listings = await prisma.listing.findMany({
    where: { agentId: userId },
    orderBy: { createdAt: "desc" },
  })

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Listings</h1>
          <p className="text-muted-foreground">{listings.length} listings</p>
        </div>
        <Link href="/agent/listings/new">
          <Button>+ New Listing</Button>
        </Link>
      </div>

      {listings.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No listings yet.</p>
          <Link href="/agent/listings/new" className="text-primary underline mt-2 inline-block">
            Create your first listing →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => (
            <Link
              key={listing.id}
              href={`/agent/listings/${listing.id}`}
              className="block rounded-lg border p-4 hover:bg-accent transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{listing.address}</p>
                  <p className="text-sm text-muted-foreground">
                    {listing.city}, {listing.state} {listing.zipCode}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">${listing.listPrice.toLocaleString()}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">
                      {listing.bedrooms}BR / {listing.bathroomsFull}BA
                    </span>
                    <Badge variant={listing.status === "ACTIVE" ? "default" : "secondary"}>
                      {listing.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}

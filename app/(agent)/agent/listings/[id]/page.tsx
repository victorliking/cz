import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DIMENSIONS, getDimension } from "@/lib/vector-schema"

export const dynamic = "force-dynamic"

export default async function ListingDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id

  if (!userId) return <p>Not authenticated</p>

  const listing = await prisma.listing.findUnique({
    where: { id: params.id },
  })

  if (!listing) return notFound()

  const vector = listing.vector as Record<string, unknown>

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/agent/listings" className="text-sm text-muted-foreground hover:text-foreground">
            ← All Listings
          </Link>
          <h1 className="text-2xl font-bold mt-1">{listing.address}</h1>
          <p className="text-muted-foreground">
            {listing.city}, {listing.state} {listing.zipCode}
          </p>
        </div>
        <Badge variant={listing.status === "ACTIVE" ? "default" : "secondary"} className="text-sm">
          {listing.status}
        </Badge>
      </div>

      {/* Key Facts */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-lg">Key Facts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Price</span>
              <p className="font-medium">${listing.listPrice.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Bedrooms</span>
              <p className="font-medium">{listing.bedrooms}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Bathrooms</span>
              <p className="font-medium">{listing.bathroomsFull} full, {listing.bathroomsHalf} half</p>
            </div>
            <div>
              <span className="text-muted-foreground">Type</span>
              <p className="font-medium">{listing.propertyType}</p>
            </div>
            {listing.interiorSqft && (
              <div>
                <span className="text-muted-foreground">Interior</span>
                <p className="font-medium">{listing.interiorSqft.toLocaleString()} sqft</p>
              </div>
            )}
            {listing.lotSqft && (
              <div>
                <span className="text-muted-foreground">Lot</span>
                <p className="font-medium">{listing.lotSqft.toLocaleString()} sqft</p>
              </div>
            )}
            {listing.yearBuilt && (
              <div>
                <span className="text-muted-foreground">Built</span>
                <p className="font-medium">{listing.yearBuilt}</p>
              </div>
            )}
            {listing.hoaFeeMonthly && (
              <div>
                <span className="text-muted-foreground">HOA</span>
                <p className="font-medium">${listing.hoaFeeMonthly}/mo</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Vector Data */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-lg">Dimension Scores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            {DIMENSIONS.filter((d) => vector[d.key] !== null && vector[d.key] !== undefined).map((dim) => (
              <div key={dim.key} className="flex justify-between border-b pb-1">
                <span className="text-muted-foreground">{dim.label}</span>
                <span className="font-medium">{formatValue(vector[dim.key], dim.dataType)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Agent Notes */}
      {listing.agentNotes && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Agent Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{listing.agentNotes}</p>
          </CardContent>
        </Card>
      )}

      {listing.listingUrl && (
        <a
          href={listing.listingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary underline"
        >
          View original listing →
        </a>
      )}
    </main>
  )
}

function formatValue(value: unknown, dataType: string): string {
  if (value === null || value === undefined) return "—"
  if (dataType === "bool") return value ? "Yes" : "No"
  if (dataType === "enum") return String(value).replace(/_/g, " ")
  if (dataType === "score_1_5") return `${value}/5`
  if (typeof value === "number") return value.toLocaleString()
  return String(value)
}

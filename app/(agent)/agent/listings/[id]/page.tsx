import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DIMENSIONS, getDimension } from "@/lib/vector-schema"
import { getSchoolRatingLabel } from "@/lib/geo/school-ratings"

export const dynamic = "force-dynamic"

// Dimensions promoted into the friendly "Key Facts" card, so we don't repeat
// them in the raw "Dimension Scores" grid below.
const PROMOTED_DIMENSIONS = new Set(["school_rating", "natural_light"])

function naturalLightLabel(score: number): string {
  if (score >= 5) return "Very bright"
  if (score >= 4) return "Bright"
  if (score >= 3) return "Average"
  if (score >= 2) return "Dim"
  return "Dark"
}

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
  const photos = (listing.photos ?? []).filter(Boolean)

  const schoolRatingRaw = vector.school_rating
  const schoolRating =
    typeof schoolRatingRaw === "number" ? schoolRatingRaw : null
  const naturalLightRaw = vector.natural_light
  const naturalLight =
    typeof naturalLightRaw === "number" ? naturalLightRaw : null

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

      {/* Photos */}
      <div className="mb-6">
        {photos.length > 0 ? (
          <div className="space-y-2">
            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-[16/9]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photos[0]}
                alt={`${listing.address} — primary photo`}
                className="w-full h-full object-cover"
              />
            </div>
            {photos.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {photos.slice(1, 9).map((url, i) => (
                  <div
                    key={i}
                    className="rounded-lg overflow-hidden border border-slate-200 bg-slate-100 aspect-[4/3]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`${listing.address} — photo ${i + 2}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 aspect-[16/9] flex flex-col items-center justify-center text-slate-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-10 h-10 mb-2"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
              />
            </svg>
            <p className="text-sm">No photos available</p>
          </div>
        )}
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
            {schoolRating !== null && (
              <div>
                <span className="text-muted-foreground">School Rating</span>
                <p className="font-medium">
                  {schoolRating}/10{" "}
                  <span className="text-muted-foreground font-normal">
                    {getSchoolRatingLabel(schoolRating)}
                  </span>
                </p>
              </div>
            )}
            {naturalLight !== null && (
              <div>
                <span className="text-muted-foreground">Natural Light</span>
                <p className="font-medium">
                  {naturalLightLabel(naturalLight)}{" "}
                  <span className="text-muted-foreground font-normal">
                    ({naturalLight}/5)
                  </span>
                </p>
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
            {DIMENSIONS.filter((d) => !PROMOTED_DIMENSIONS.has(d.key) && vector[d.key] !== null && vector[d.key] !== undefined).map((dim) => (
              <div key={dim.key} className="flex justify-between border-b pb-1">
                <span className="text-muted-foreground">{dim.label}</span>
                <span className="font-medium">{formatValue(vector[dim.key], dim.dataType)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Listing Description (MLS remarks) */}
      {listing.agentNotes && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Listing Description (MLS)</CardTitle>
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

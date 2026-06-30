"use client"

import { useEffect, useState } from "react"

/**
 * Journey timeline: a reverse-chronological view of what the agent recommended
 * to a buyer and when, with per-listing "Shown"/"Reacted" badges.
 *
 * Consumes Agent K's `listRecommendationBatches` shape, surfaced via the
 * `GET /api/recommendations?buyerProfileId=...` endpoint. Everything is treated
 * as optional/possibly-empty so the component never crashes on partial or
 * missing history — it simply renders the empty state.
 */

interface TimelineListing {
  id?: string
  address?: string | null
  city?: string | null
  listPrice?: number | null
  photos?: string[] | null
}

interface TimelineRecommendation {
  id?: string
  listingId?: string
  score?: number | null
  shownToBuyerAt?: string | null
  // Optional reaction marker — if Agent K joins feedback/reaction state in.
  reactedAt?: string | null
  hasReaction?: boolean | null
  listing?: TimelineListing | null
}

interface TimelineBatch {
  id?: string
  createdAt?: string | null
  agentReviewedAt?: string | null
  notes?: string | null
  recommendations?: TimelineRecommendation[] | null
}

interface JourneyTimelineProps {
  buyerProfileId: string
  /**
   * Optional server-fetched batches. When provided, the component renders these
   * directly and skips the client fetch (lets a server page pass
   * `listRecommendationBatches(...)` output straight in). When omitted, it
   * fetches `/api/recommendations` itself.
   */
  initialBatches?: TimelineBatch[]
}

function formatPrice(price?: number | null): string {
  if (price == null || Number.isNaN(price)) return ""
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(1)}M`
  if (price >= 1_000) return `$${Math.round(price / 1_000)}k`
  return `$${price}`
}

function formatDate(value?: string | null): string {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function hasReacted(rec: TimelineRecommendation): boolean {
  return Boolean(rec.hasReaction || rec.reactedAt)
}

function isShown(rec: TimelineRecommendation): boolean {
  return Boolean(rec.shownToBuyerAt)
}

export function JourneyTimeline({ buyerProfileId, initialBatches }: JourneyTimelineProps) {
  const [batches, setBatches] = useState<TimelineBatch[]>(initialBatches ?? [])
  const [loading, setLoading] = useState(initialBatches === undefined)

  useEffect(() => {
    // If the server already handed us batches, don't double-fetch.
    if (initialBatches !== undefined) return
    let cancelled = false
    setLoading(true)
    fetch(`/api/recommendations?buyerProfileId=${encodeURIComponent(buyerProfileId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        // Tolerate either { batches: [...] } or a bare array.
        const next: TimelineBatch[] = Array.isArray(data)
          ? data
          : Array.isArray(data.batches)
            ? data.batches
            : []
        setBatches(next)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [buyerProfileId, initialBatches])

  if (loading) {
    return (
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
          Recommendation History
        </h2>
        <div className="border border-dashed rounded-lg p-6 text-center">
          <p className="text-sm text-slate-400">Loading recommendation history...</p>
        </div>
      </section>
    )
  }

  // Defensive: only keep batches that actually have something to show, and sort
  // reverse-chronologically (newest first) regardless of server ordering.
  const safeBatches = (Array.isArray(batches) ? batches : [])
    .filter((b): b is TimelineBatch => Boolean(b))
    .slice()
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return tb - ta
    })

  if (safeBatches.length === 0) {
    return (
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
          Recommendation History
        </h2>
        <div className="border border-dashed rounded-lg p-6 text-center">
          <p className="text-sm text-slate-400">No recommendation history yet.</p>
          <p className="text-xs text-slate-300 mt-1">
            Generate matches to start tracking recommended → shown → reacted over time.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
        Recommendation History ({safeBatches.length})
      </h2>

      {/* Vertical timeline: a left rail with a node per batch. */}
      <div className="relative pl-6">
        <div className="absolute left-1.5 top-1 bottom-1 w-px bg-slate-200" aria-hidden />

        <div className="space-y-6">
          {safeBatches.map((batch, idx) => {
            const recs = (batch.recommendations ?? []).filter(
              (r): r is TimelineRecommendation => Boolean(r)
            )
            const shownCount = recs.filter(isShown).length

            return (
              <div key={batch.id ?? idx} className="relative">
                {/* Timeline node */}
                <div className="absolute -left-[18px] top-1.5 h-3 w-3 rounded-full bg-blue-500 ring-4 ring-white" aria-hidden />

                <div className="flex items-baseline justify-between flex-wrap gap-x-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatDate(batch.createdAt) || "Recommendation batch"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {recs.length} {recs.length === 1 ? "home" : "homes"}
                    {shownCount > 0 ? ` · ${shownCount} shown` : ""}
                  </p>
                </div>

                {batch.notes && (
                  <p className="text-xs text-slate-500 italic mt-0.5">{batch.notes}</p>
                )}

                {recs.length === 0 ? (
                  <p className="text-xs text-slate-300 mt-2">No homes recorded in this batch.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {recs.map((rec, rIdx) => {
                      const listing = rec.listing ?? {}
                      const thumb = listing.photos?.[0]
                      const reacted = hasReacted(rec)
                      const shown = isShown(rec)

                      return (
                        <div
                          key={rec.id ?? rec.listingId ?? rIdx}
                          className="flex items-center gap-3 border border-slate-100 rounded-lg p-2.5 bg-white"
                        >
                          {/* Thumbnail */}
                          <div className="h-12 w-16 flex-shrink-0 rounded-md overflow-hidden bg-slate-100">
                            {thumb ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={thumb}
                                alt={listing.address ?? "Listing"}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-[10px] text-slate-300">
                                No photo
                              </div>
                            )}
                          </div>

                          {/* Listing meta */}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {listing.address || "Address unavailable"}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {[listing.city, formatPrice(listing.listPrice)]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>

                          {/* Score + status badges */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {rec.score != null && !Number.isNaN(rec.score) && (
                              <span className="text-xs font-semibold text-slate-600 tabular-nums">
                                {Math.round(rec.score)}
                              </span>
                            )}
                            {reacted ? (
                              <span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full">
                                Reacted
                              </span>
                            ) : shown ? (
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                                Shown
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-50 text-slate-400 text-xs font-medium rounded-full">
                                Recommended
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

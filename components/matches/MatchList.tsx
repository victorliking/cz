"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import type { MatchResult, DimensionScore } from "@/lib/scoring/match-engine"
import { getSchoolRatingLabel } from "@/lib/geo/school-ratings"
import { resizePhotoUrl } from "@/lib/mls/field-map"

// --- Learning surface (from GET /api/matches; all fields optional, treated defensively) ---
interface LearningShift {
  dimension: string
  direction: "up" | "down"
  delta: number
}
interface LearningSummary {
  active?: boolean
  evidenceCount?: number
  summary?: string
  shifts?: LearningShift[]
}
interface RankBoost {
  movedUp?: number
  reason?: string
}
// The matches API enriches each listing with the full photo array and the real
// MLS listing URL (see agent D's contract). Both treated as optional.
type EnrichedListing = MatchResult["listing"] & {
  photos?: string[]
  listingUrl?: string | null
}
// MatchResult may carry an optional rankBoost the engine type doesn't yet declare,
// plus the photos/listingUrl enrichment on the listing object.
type ScoredMatch = Omit<MatchResult, "listing"> & {
  listing: EnrichedListing
  rankBoost?: RankBoost
}

// Optional props let a parent override what the component would otherwise read
// from GET /api/matches. All default to undefined so existing callers that
// render <MatchList /> with no props keep working unchanged.
interface MatchListProps {
  relaxed?: boolean
  relaxedReason?: string | null
}

export function MatchList({ relaxed: relaxedProp, relaxedReason: relaxedReasonProp }: MatchListProps = {}) {
  const [matches, setMatches] = useState<ScoredMatch[]>([])
  const [learning, setLearning] = useState<LearningSummary | null>(null)
  const [relaxed, setRelaxed] = useState(false)
  const [relaxedReason, setRelaxedReason] = useState<string | null>(null)
  const [intakeComplete, setIntakeComplete] = useState(true)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/matches")
      .then((r) => r.json())
      .then((d) => {
        setMatches(d.matches || [])
        setLearning(d.learning ?? null)
        setRelaxed(!!d.relaxed)
        setRelaxedReason(d.relaxedReason ?? null)
        // The API omits relaxed/learning/totalConsidered when intake isn't done
        // (it returns just { matches: [] }). Use the presence of those fields to
        // tell "no inventory in your criteria" apart from "intake not done".
        setIntakeComplete("relaxed" in d || "totalConsidered" in d || "learning" in d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Props win when provided, otherwise fall back to the fetched payload.
  const showRelaxed = relaxedProp ?? relaxed
  const shownReason = relaxedReasonProp ?? relaxedReason

  if (loading) return <div className="animate-pulse h-48 bg-slate-50 rounded-xl" />
  if (matches.length === 0) {
    // Honest empty state: only prompt the questionnaire when it isn't done yet.
    if (!intakeComplete) {
      return (
        <div className="border border-dashed rounded-xl p-8 text-center">
          <p className="text-sm text-slate-400">No matches yet.</p>
          <p className="text-xs text-slate-300 mt-1">Complete your intake questionnaire to see personalized matches.</p>
        </div>
      )
    }
    return (
      <div className="border border-dashed rounded-xl p-8 text-center">
        <p className="text-sm text-slate-400">No homes match your criteria right now.</p>
        <p className="text-xs text-slate-300 mt-1">
          There&rsquo;s no current inventory in your price range and area. We&rsquo;ll keep looking as new
          listings come on the market — or adjust your budget or target areas to widen the search.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Learning banner — only when the system actually re-ranked from showings */}
      <LearningBanner learning={learning} />

      {/* Relaxed-search notice — honest disclosure when the API widened the
          filters (budget/area) to surface enough matches. */}
      {showRelaxed && <RelaxedNotice reason={shownReason} />}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Your Top Matches</h2>
        <span className="text-xs text-slate-400">{matches.length} homes scored</span>
      </div>

      <div className="space-y-3">
        {matches.map((match) => (
          <MatchExplanationCard
            key={match.listing.id}
            match={match}
            isExpanded={expanded === match.listing.id}
            onToggle={() => setExpanded(expanded === match.listing.id ? null : match.listing.id)}
          />
        ))}
      </div>
    </div>
  )
}

function RelaxedNotice({ reason }: { reason: string | null }) {
  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0 text-amber-500" aria-hidden>&#9888;</span>
        <p className="text-xs text-amber-800 leading-snug">
          <span className="font-semibold">Search widened to find more options. </span>
          {reason || "We expanded your budget or area to surface more matches."} Some homes below may fall
          outside your original criteria.
        </p>
      </div>
    </div>
  )
}

function LearningBanner({ learning }: { learning: LearningSummary | null }) {
  if (!learning || !learning.active) return null

  const shifts = (learning.shifts || []).filter((s) => s && s.dimension).slice(0, 3)
  const summary = learning.summary || "Updated from your showings."

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0 text-base leading-none" aria-hidden>&#10024;</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-blue-900">{summary}</p>
          {shifts.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {shifts.map((s, i) => (
                <ShiftChip key={`${s.dimension}-${i}`} shift={s} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ShiftChip({ shift }: { shift: LearningShift }) {
  const up = shift.direction === "up"
  const label = humanizeDimension(shift.dimension)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
        up
          ? "bg-green-50 text-green-700 border-green-200"
          : "bg-amber-50 text-amber-700 border-amber-200"
      )}
    >
      <span aria-hidden>{up ? "↑" : "↓"}</span>
      {label}
    </span>
  )
}

function humanizeDimension(dimension: string): string {
  // Turn snake/kebab dimension keys into a readable label, e.g. "natural_light" -> "natural light".
  return dimension.replace(/[_-]+/g, " ").trim() || dimension
}

function MatchExplanationCard({
  match,
  isExpanded,
  onToggle,
}: {
  match: ScoredMatch
  isExpanded: boolean
  onToggle: () => void
}) {
  const formatPrice = (price: number) => {
    if (price >= 1000000) return `$${(price / 1000000).toFixed(2)}M`
    return `$${Math.round(price / 1000)}k`
  }

  const rawHero = match.listing.photos?.find(Boolean) ?? match.listing.imageUrl
  // Fetch a card-sized image (not the stored 1024x768 ~730KB) for speed.
  const heroPhoto = rawHero ? resizePhotoUrl(rawHero, 600, 338) : undefined

  return (
    <div
      className={cn(
        "border rounded-xl transition-all cursor-pointer hover:shadow-md overflow-hidden",
        isExpanded ? "ring-2 ring-blue-200 shadow-md" : ""
      )}
      onClick={onToggle}
    >
      {/* Hero photo (graceful placeholder when no photos) */}
      <div className="bg-slate-100 aspect-[16/9] w-full">
        {heroPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroPhoto}
            alt={match.listing.address}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-8 h-8 mb-1"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
              />
            </svg>
            <span className="text-xs">No photos available</span>
          </div>
        )}
      </div>

      {/* Card header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-slate-900 truncate">{match.listing.address}</h3>
              <VerdictBadge verdict={match.verdict} />
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {match.listing.city} · {match.listing.bedrooms}BR/{match.listing.bathrooms}BA · {match.listing.sqft.toLocaleString()} sqft
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-slate-900">{formatPrice(match.listing.price)}</p>
            <ScoreBadge score={match.score} verdict={match.verdict} />
          </div>
        </div>

        {/* Rank boost — surfaces what the learner moved up and why */}
        {match.rankBoost && (match.rankBoost.reason || (match.rankBoost.movedUp ?? 0) > 0) && (
          <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-green-50 border border-green-100 px-2.5 py-1.5">
            <span className="mt-0.5 shrink-0 text-green-600" aria-hidden>↑</span>
            <p className="text-xs text-green-800 font-medium leading-snug">
              {(match.rankBoost.movedUp ?? 0) > 0 && (
                <span>Moved up {match.rankBoost.movedUp} {match.rankBoost.movedUp === 1 ? "spot" : "spots"}</span>
              )}
              {(match.rankBoost.movedUp ?? 0) > 0 && match.rankBoost.reason && <span className="text-green-400"> · </span>}
              {match.rankBoost.reason && <span className="font-normal">{match.rankBoost.reason}</span>}
            </p>
          </div>
        )}

        {/* Quick badges row */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {match.listing.dimensions.school_rating && (
            <SchoolBadge rating={match.listing.dimensions.school_rating} />
          )}
          {match.listing.dimensions.commute_primary && (
            <span className="px-2 py-0.5 bg-slate-50 text-slate-600 text-xs rounded-full border border-slate-200">
              {match.listing.dimensions.commute_primary} min commute
            </span>
          )}
          {match.listing.dimensions.walk_score && (
            <span className="px-2 py-0.5 bg-slate-50 text-slate-600 text-xs rounded-full border border-slate-200">
              Walk: {match.listing.dimensions.walk_score}
            </span>
          )}
        </div>

        {/* Reasons preview (always visible) */}
        {match.reasons.length > 0 && (
          <div className="mt-3 space-y-1">
            {match.reasons.slice(0, 2).map((r, i) => (
              <p key={i} className="text-xs text-green-700 flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0">&#10003;</span>
                <span>{r}</span>
              </p>
            ))}
            {match.reasons.length > 2 && !isExpanded && (
              <p className="text-xs text-slate-400">+ {match.reasons.length - 2} more reasons</p>
            )}
          </div>
        )}

        {/* Highlights chips */}
        {match.highlights.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {match.highlights.map((h, i) => (
              <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">
                {h}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Expanded section */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0 border-t mx-4 mt-0 pt-3 space-y-4">
          {/* Full reasons */}
          {match.reasons.length > 2 && (
            <div>
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1.5">Why This Matches You</p>
              <ul className="space-y-1">
                {match.reasons.map((r, i) => (
                  <li key={i} className="text-xs text-slate-700 flex items-start gap-1.5">
                    <span className="text-green-500 mt-0.5 shrink-0">&#10003;</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Concerns */}
          {match.concerns.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1.5">Things to Consider</p>
              <ul className="space-y-1">
                {match.concerns.map((c, i) => (
                  <li key={i} className="text-xs text-slate-700 flex items-start gap-1.5">
                    <span className="text-amber-500 mt-0.5 shrink-0">&#9888;</span>{c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Dimension score breakdown */}
          {match.dimensionScores && match.dimensionScores.length > 0 && (
            <DimensionBreakdown scores={match.dimensionScores} />
          )}

          {/* Listing description (MLS remarks) */}
          {match.listing.description && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Listing Description</p>
              <p className="text-xs text-slate-600 leading-relaxed">{match.listing.description}</p>
            </div>
          )}

          {/* External links — use the real MLS listing URL when available;
              only fall back to a (clearly labeled) Redfin search otherwise. */}
          <div className="flex gap-3 pt-1">
            {match.listing.listingUrl ? (
              <a
                href={match.listing.listingUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs font-medium text-[#007AFF] hover:text-[#0056b3] transition-all"
              >
                View listing
              </a>
            ) : (
              <a
                href={`https://www.redfin.com/MA/${match.listing.city.replace(/\s+/g, '-')}/${match.listing.address.replace(/\s+/g, '-')}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs font-medium text-[#007AFF] hover:text-[#0056b3] transition-all"
              >
                Search on Redfin
              </a>
            )}
            <a
              href={`https://www.google.com/maps/search/${encodeURIComponent(match.listing.address + ', ' + match.listing.city + ', MA')}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs font-medium text-[#007AFF] hover:text-[#0056b3] transition-all"
            >
              Map
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

function ScoreBadge({ score, verdict }: { score: number; verdict: string }) {
  const color =
    verdict === "strong" ? "text-green-700" :
    verdict === "good" ? "text-blue-700" :
    verdict === "fair" ? "text-amber-700" : "text-slate-500"

  return (
    <div className="flex items-center gap-1.5 mt-0.5">
      <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            verdict === "strong" ? "bg-green-500" :
            verdict === "good" ? "bg-blue-500" :
            verdict === "fair" ? "bg-amber-500" : "bg-slate-400"
          )}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn("text-xs font-bold", color)}>{score}%</span>
    </div>
  )
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const styles: Record<string, string> = {
    strong: "bg-green-100 text-green-800 border-green-200",
    good: "bg-blue-100 text-blue-800 border-blue-200",
    fair: "bg-amber-100 text-amber-800 border-amber-200",
    weak: "bg-slate-100 text-slate-600 border-slate-200",
  }
  const labels: Record<string, string> = {
    strong: "Strong Match",
    good: "Good Match",
    fair: "Worth Seeing",
    weak: "Stretch",
  }

  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border shrink-0", styles[verdict])}>
      {labels[verdict]}
    </span>
  )
}

function SchoolBadge({ rating }: { rating: number }) {
  const label = getSchoolRatingLabel(rating)
  const color =
    rating >= 8 ? "bg-green-50 text-green-700 border-green-200" :
    rating >= 6 ? "bg-blue-50 text-blue-700 border-blue-200" :
    rating >= 4 ? "bg-amber-50 text-amber-700 border-amber-200" :
    "bg-red-50 text-red-700 border-red-200"

  return (
    <span className={cn("px-2 py-0.5 text-xs rounded-full border font-medium", color)}>
      Schools: {rating}/10 {label}
    </span>
  )
}

function DimensionBreakdown({ scores }: { scores: DimensionScore[] }) {
  // Older API payloads may not carry `assessed`; default to true so they render
  // exactly as before. New payloads flag dimensions the listing had no data for.
  const isAssessed = (ds: DimensionScore) => ds.assessed !== false

  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Score Breakdown (Your Priorities)</p>
      <div className="space-y-2">
        {scores.map((ds) => (
          <div key={ds.dimension} className="flex items-center gap-2">
            <span className="text-xs text-slate-600 w-16 shrink-0 truncate" title={ds.dimension}>
              {ds.label}
            </span>
            {isAssessed(ds) ? (
              <>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      ds.score >= 70 ? "bg-green-500" :
                      ds.score >= 50 ? "bg-blue-400" :
                      ds.score >= 30 ? "bg-amber-400" : "bg-red-400"
                    )}
                    style={{ width: `${ds.score}%` }}
                  />
                </div>
                <span className={cn(
                  "text-xs font-bold w-8 text-right",
                  ds.score >= 70 ? "text-green-600" :
                  ds.score >= 50 ? "text-blue-600" :
                  ds.score >= 30 ? "text-amber-600" : "text-red-500"
                )}>
                  {ds.score}
                </span>
              </>
            ) : (
              <>
                {/* No data for this dimension — show an empty track and say so
                    rather than implying a real (often midpoint) score. */}
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden" />
                <span className="text-xs italic text-slate-400 w-8 text-right" title="Not yet assessed">
                  &mdash;
                </span>
              </>
            )}
            <span className="text-xs text-slate-300 w-8 text-right">
              {Math.round(ds.weight * 100)}%
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-300 mt-1.5">
        Score per dimension · &ldquo;&mdash;&rdquo; = not yet assessed · Right column = your priority weight
      </p>
    </div>
  )
}

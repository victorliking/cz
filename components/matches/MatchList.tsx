"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import type { MatchResult, DimensionScore } from "@/lib/scoring/match-engine"
import { getSchoolRatingLabel } from "@/lib/geo/school-ratings"

export function MatchList() {
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/matches")
      .then((r) => r.json())
      .then((d) => {
        setMatches(d.matches || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="animate-pulse h-48 bg-slate-50 rounded-xl" />
  if (matches.length === 0) {
    return (
      <div className="border border-dashed rounded-xl p-8 text-center">
        <p className="text-sm text-slate-400">No matches yet.</p>
        <p className="text-xs text-slate-300 mt-1">Complete your intake questionnaire to see personalized matches.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
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

function MatchExplanationCard({
  match,
  isExpanded,
  onToggle,
}: {
  match: MatchResult
  isExpanded: boolean
  onToggle: () => void
}) {
  const formatPrice = (price: number) => {
    if (price >= 1000000) return `$${(price / 1000000).toFixed(2)}M`
    return `$${Math.round(price / 1000)}k`
  }

  return (
    <div
      className={cn(
        "border rounded-xl transition-all cursor-pointer hover:shadow-md",
        isExpanded ? "ring-2 ring-blue-200 shadow-md" : ""
      )}
      onClick={onToggle}
    >
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

          {/* Agent notes */}
          {match.listing.description && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Agent Notes</p>
              <p className="text-xs text-slate-600 leading-relaxed">{match.listing.description}</p>
            </div>
          )}
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
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Score Breakdown (Your Priorities)</p>
      <div className="space-y-2">
        {scores.map((ds) => (
          <div key={ds.dimension} className="flex items-center gap-2">
            <span className="text-xs text-slate-600 w-16 shrink-0 truncate" title={ds.dimension}>
              {ds.label}
            </span>
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
            <span className="text-xs text-slate-300 w-8 text-right">
              {Math.round(ds.weight * 100)}%
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-300 mt-1.5">Score per dimension · Right column = your priority weight</p>
    </div>
  )
}

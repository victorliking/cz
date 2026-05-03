"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import type { MatchResult } from "@/lib/scoring/match-engine"

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
  if (matches.length === 0) return null

  const formatPrice = (price: number) => {
    if (price >= 1000000) return `$${(price / 1000000).toFixed(2)}M`
    return `$${Math.round(price / 1000)}k`
  }

  const verdictColors: Record<string, string> = {
    strong: "bg-green-100 text-green-800 border-green-200",
    good: "bg-blue-100 text-blue-800 border-blue-200",
    fair: "bg-amber-100 text-amber-800 border-amber-200",
    weak: "bg-slate-100 text-slate-600 border-slate-200",
  }

  const verdictLabels: Record<string, string> = {
    strong: "Strong Match",
    good: "Good Match",
    fair: "Worth Seeing",
    weak: "Stretch",
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Your Top Matches</h2>
        <span className="text-xs text-slate-400">{matches.length} homes found</span>
      </div>

      <div className="space-y-3">
        {matches.map((match) => (
          <div
            key={match.listing.id}
            className={cn(
              "border rounded-xl p-4 transition-all cursor-pointer hover:shadow-md",
              expanded === match.listing.id ? "ring-2 ring-blue-200" : ""
            )}
            onClick={() => setExpanded(expanded === match.listing.id ? null : match.listing.id)}
          >
            {/* Header row */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900">{match.listing.address}</h3>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-medium border",
                    verdictColors[match.verdict]
                  )}>
                    {verdictLabels[match.verdict]}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">
                  {match.listing.city} · {match.listing.bedrooms}BR/{match.listing.bathrooms}BA · {match.listing.sqft.toLocaleString()} sqft · {match.listing.yearBuilt}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-slate-900">{formatPrice(match.listing.price)}</p>
                <div className="flex items-center gap-1 justify-end mt-0.5">
                  <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        match.score >= 80 ? "bg-green-500" :
                        match.score >= 65 ? "bg-blue-500" :
                        match.score >= 50 ? "bg-amber-500" : "bg-slate-400"
                      )}
                      style={{ width: `${match.score}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-600">{match.score}</span>
                </div>
              </div>
            </div>

            {/* Highlights (always visible) */}
            {match.highlights.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {match.highlights.map((h, i) => (
                  <span key={i} className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full">
                    ✓ {h}
                  </span>
                ))}
              </div>
            )}

            {/* Expanded detail */}
            {expanded === match.listing.id && (
              <div className="mt-4 pt-3 border-t space-y-3">
                {/* Description */}
                {match.listing.description && (
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {match.listing.description}
                  </p>
                )}

                {/* Why it matches */}
                {match.reasons.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-green-700 uppercase mb-1">Why This Matches You</p>
                    <ul className="space-y-0.5">
                      {match.reasons.map((r, i) => (
                        <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                          <span className="text-green-500 mt-0.5">●</span>{r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Concerns */}
                {match.concerns.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-700 uppercase mb-1">Things to Consider</p>
                    <ul className="space-y-0.5">
                      {match.concerns.map((c, i) => (
                        <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                          <span className="text-amber-500 mt-0.5">●</span>{c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Dimensions */}
                <div className="grid grid-cols-4 gap-2 pt-2">
                  {match.listing.dimensions.school_rating && (
                    <MiniStat label="Schools" value={`${match.listing.dimensions.school_rating}/10`} />
                  )}
                  {match.listing.dimensions.natural_light && (
                    <MiniStat label="Light" value={`${match.listing.dimensions.natural_light}/5`} />
                  )}
                  {match.listing.dimensions.noise_level && (
                    <MiniStat label="Quiet" value={`${match.listing.dimensions.noise_level}/5`} />
                  )}
                  {match.listing.dimensions.walk_score && (
                    <MiniStat label="Walk Score" value={`${match.listing.dimensions.walk_score}`} />
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center bg-slate-50 rounded-lg py-1.5">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-bold text-slate-700">{value}</p>
    </div>
  )
}

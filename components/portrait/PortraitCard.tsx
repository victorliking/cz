"use client"

import { useEffect, useState } from "react"
import type { BuyerPortrait } from "@/lib/portrait/generate-portrait"

export function PortraitCard() {
  const [portrait, setPortrait] = useState<BuyerPortrait | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/portrait")
      .then((res) => res.json())
      .then((data) => {
        setPortrait(data.portrait)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="animate-pulse h-64 bg-slate-50 rounded-xl" />
  if (!portrait) return null

  return (
    <div className="space-y-8 max-w-xl">
      {/* Archetype */}
      <section>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
          Your Buyer Type
        </p>
        <h2 className="text-2xl font-bold text-slate-900">{portrait.archetype.type}</h2>
        <p className="text-base text-slate-600 mt-1">{portrait.archetype.headline}</p>
      </section>

      {/* Profile prose */}
      {portrait.prose.length > 0 && (
        <section>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
            What We See
          </p>
          <div className="space-y-3">
            {portrait.prose.map((p, i) => (
              <p key={i} className="text-sm text-slate-700 leading-relaxed">{p}</p>
            ))}
          </div>
        </section>
      )}

      {/* Blind spots */}
      {portrait.blindSpots.length > 0 && (
        <section>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
            Things You Might Not Have Realized
          </p>
          <div className="space-y-3">
            {portrait.blindSpots.map((spot, i) => (
              <p key={i} className="text-sm text-slate-700 leading-relaxed">{spot}</p>
            ))}
          </div>
        </section>
      )}

      {/* Search strategy */}
      {portrait.searchStrategy && (
        <section>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
            What We Should Look For
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">{portrait.searchStrategy}</p>
        </section>
      )}

      {/* Three words */}
      {portrait.freeText?.threeWords && (
        <section className="pt-4 border-t">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
            In Your Words
          </p>
          <p className="text-lg text-slate-800 italic">
            &ldquo;{portrait.freeText.threeWords}&rdquo;
          </p>
          {portrait.freeText.notes && (
            <p className="text-sm text-slate-500 mt-2">{portrait.freeText.notes}</p>
          )}
        </section>
      )}
    </div>
  )
}

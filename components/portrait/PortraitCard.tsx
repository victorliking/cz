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

  if (loading) return <div className="animate-pulse h-96 bg-slate-100 rounded-xl" />
  if (!portrait) return null

  const formatDollar = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`
    return `$${val}`
  }

  return (
    <div className="space-y-4">
      {/* Budget */}
      <section className="bg-white border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-2">💰 Budget</h3>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg font-bold text-blue-600">{formatDollar(portrait.budget.comfortable)}</span>
          <span className="text-sm text-slate-400">→</span>
          <span className="text-lg font-bold text-green-600">{formatDollar(portrait.budget.stretch)}</span>
        </div>
        {portrait.budget.cities.length > 0 && (
          <div className="grid grid-cols-2 gap-1">
            {portrait.budget.cities.slice(0, 6).map((c) => (
              <div key={c.name} className="flex justify-between text-xs p-1.5 bg-slate-50 rounded">
                <span>{c.name}</span>
                <span className="font-medium">{formatDollar(c.maxPrice)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Hard Filters */}
      <section className="bg-white border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-2">🏠 Must-Haves</h3>
        <div className="flex flex-wrap gap-2">
          <Chip>{portrait.hardFilters.minBedrooms}+ BR</Chip>
          <Chip>{portrait.hardFilters.minBathrooms}+ BA</Chip>
          {portrait.hardFilters.propertyTypes.map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </div>
        {portrait.hardFilters.targetCities.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {portrait.hardFilters.targetCities.map((c) => (
              <span key={c} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{c}</span>
            ))}
          </div>
        )}
      </section>

      {/* Priority Vector */}
      <section className="bg-white border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-2">📊 Priority Weights</h3>
        <div className="space-y-2">
          {portrait.priorities.slice(0, 5).map((p) => (
            <div key={p.item} className="flex items-center gap-2">
              <span className="text-xs text-slate-400 w-5">#{p.rank}</span>
              <div className="flex-1">
                <div className="flex justify-between mb-0.5">
                  <span className="text-xs font-medium text-slate-700">{p.item}</span>
                  <span className="text-xs text-slate-400">{Math.round(p.weight * 100)}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${p.weight * 400}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Lifestyle */}
      {portrait.lifestyle.saturdayMorning.length > 0 && (
        <section className="bg-white border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">☀️ Lifestyle</h3>
          <div className="space-y-1">
            {portrait.lifestyle.saturdayMorning.map((s) => (
              <p key={s} className="text-xs text-slate-600">• {s}</p>
            ))}
            {portrait.lifestyle.hostingStyle && (
              <p className="text-xs text-slate-600 mt-2">🎉 {portrait.lifestyle.hostingStyle}</p>
            )}
            {portrait.lifestyle.renovationAppetite && (
              <p className="text-xs text-slate-600">🔨 {portrait.lifestyle.renovationAppetite}</p>
            )}
          </div>
        </section>
      )}

      {/* Dealbreakers */}
      {portrait.dealbreakers.length > 0 && (
        <section className="bg-red-50 border border-red-100 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-red-900 mb-2">⛔ Must Avoid</h3>
          <div className="flex flex-wrap gap-1">
            {portrait.dealbreakers.map((d) => (
              <span key={d} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full">{d}</span>
            ))}
          </div>
        </section>
      )}

      {/* AI Insights */}
      {portrait.insights.length > 0 && (
        <section className="bg-purple-50 border border-purple-100 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-purple-900 mb-2">🧠 What we learned about you</h3>
          <div className="space-y-2">
            {portrait.insights.map((insight, idx) => (
              <p key={idx} className="text-xs text-purple-700">💡 {insight}</p>
            ))}
          </div>
        </section>
      )}

      {/* Free Text */}
      {portrait.freeText.threeWords && (
        <section className="bg-white border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">✨ Your dream home in 3 words</h3>
          <p className="text-lg font-medium text-slate-700 italic">&ldquo;{portrait.freeText.threeWords}&rdquo;</p>
          {portrait.freeText.notes && (
            <p className="text-xs text-slate-500 mt-2">{portrait.freeText.notes}</p>
          )}
        </section>
      )}
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full font-medium">
      {children}
    </span>
  )
}

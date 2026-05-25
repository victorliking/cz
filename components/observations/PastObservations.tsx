"use client"

import { useEffect, useState } from "react"

interface Observation {
  id: string
  lingeredOn: string[]
  reactedNegativelyTo: string[]
  unpromptedQuotes: string | null
  durationVsAverage: string | null
  agentConfidence: number
  createdAt: string
  showing: {
    listing: {
      address: string
      city: string
    }
  }
}

interface PastObservationsProps {
  buyerProfileId: string
}

export function PastObservations({ buyerProfileId }: PastObservationsProps) {
  const [observations, setObservations] = useState<Observation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/observations?buyerProfileId=${buyerProfileId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.observations) setObservations(data.observations)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [buyerProfileId])

  if (loading) {
    return (
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
          Agent Observations
        </h2>
        <div className="border border-dashed rounded-lg p-6 text-center">
          <p className="text-sm text-slate-400">Loading observations...</p>
        </div>
      </section>
    )
  }

  if (observations.length === 0) {
    return (
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
          Agent Observations
        </h2>
        <div className="border border-dashed rounded-lg p-6 text-center">
          <p className="text-sm text-slate-400">No observations recorded yet.</p>
          <p className="text-xs text-slate-300 mt-1">
            Record observations after showings to improve preference learning.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
        Agent Observations ({observations.length})
      </h2>
      <div className="space-y-3">
        {observations.map((obs) => (
          <div key={obs.id} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-900">
                {obs.showing.listing.address}, {obs.showing.listing.city}
              </p>
              <span className="text-xs text-slate-400">
                {new Date(obs.createdAt).toLocaleDateString()}
              </span>
            </div>

            {obs.lingeredOn.length > 0 && (
              <div className="mb-2">
                <span className="text-xs text-slate-500">Lingered on: </span>
                <div className="inline-flex flex-wrap gap-1 mt-0.5">
                  {obs.lingeredOn.map((item) => (
                    <span
                      key={item}
                      className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {obs.reactedNegativelyTo.length > 0 && (
              <div className="mb-2">
                <span className="text-xs text-slate-500">Reacted negatively: </span>
                <div className="inline-flex flex-wrap gap-1 mt-0.5">
                  {obs.reactedNegativelyTo.map((item) => (
                    <span
                      key={item}
                      className="px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded-full"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {obs.unpromptedQuotes && (
              <p className="text-xs text-slate-600 italic mt-1">
                &ldquo;{obs.unpromptedQuotes}&rdquo;
              </p>
            )}

            <div className="flex items-center gap-4 mt-2 pt-2 border-t border-slate-100">
              {obs.durationVsAverage && (
                <span className="text-xs text-slate-500">
                  Duration: {obs.durationVsAverage === "longer" ? "Longer" : obs.durationVsAverage === "shorter" ? "Shorter" : "Average"}
                </span>
              )}
              <span className="text-xs text-slate-500">
                Confidence: {obs.agentConfidence}/5
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

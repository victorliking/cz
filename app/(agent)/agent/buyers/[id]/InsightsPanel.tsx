"use client"

import { useEffect, useState, useCallback } from "react"

interface InsightData {
  dimension?: string
  statedRank?: number
  revealedRank?: number
  confidence?: number
  agentPrompt?: string
}

interface Insight {
  id: string
  kind: string
  message: string
  data: InsightData
  createdAt: string
}

interface InsightsPanelProps {
  buyerProfileId: string
}

const KIND_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
  STATED_VS_REVEALED_MISMATCH: {
    label: "Preference Mismatch",
    color: "#1d1d1f",
    bgColor: "#f5f5f7",
    borderColor: "#d2d2d7",
  },
  BUDGET_DRIFT: {
    label: "Budget Signal",
    color: "#1d1d1f",
    bgColor: "#f5f5f7",
    borderColor: "#d2d2d7",
  },
  PREFERENCE_CONVERGED: {
    label: "Preference Converged",
    color: "#1d1d1f",
    bgColor: "#f5f5f7",
    borderColor: "#d2d2d7",
  },
  NEW_PATTERN: {
    label: "New Pattern",
    color: "#1d1d1f",
    bgColor: "#f5f5f7",
    borderColor: "#d2d2d7",
  },
}

function getKindConfig(kind: string) {
  return KIND_CONFIG[kind] || KIND_CONFIG.STATED_VS_REVEALED_MISMATCH
}

export function InsightsPanel({ buyerProfileId }: InsightsPanelProps) {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissing, setDismissing] = useState<string | null>(null)

  const fetchInsights = useCallback(async () => {
    try {
      const res = await fetch(`/api/insights?buyerProfileId=${buyerProfileId}`)
      if (res.ok) {
        const data = await res.json()
        setInsights(data.insights || [])
      }
    } catch {
      // Silently fail — insights are non-critical
    } finally {
      setLoading(false)
    }
  }, [buyerProfileId])

  useEffect(() => {
    fetchInsights()
  }, [fetchInsights])

  const handleDismiss = async (insightId: string) => {
    setDismissing(insightId)
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insightId }),
      })
      if (res.ok) {
        setInsights(prev => prev.filter(i => i.id !== insightId))
      }
    } catch {
      // Silently fail
    } finally {
      setDismissing(null)
    }
  }

  if (loading || insights.length === 0) return null

  return (
    <section className="mb-8">
      <h2
        className="text-sm font-semibold uppercase tracking-wide mb-3"
        style={{ color: "#1d1d1f" }}
      >
        Behavioral Insights
      </h2>
      <div className="space-y-3">
        {insights.map((insight) => {
          const config = getKindConfig(insight.kind)
          return (
            <div
              key={insight.id}
              className="bg-white rounded-2xl shadow-sm border p-5"
              style={{ borderColor: config.borderColor }}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <KindIcon kind={insight.kind} />
                  <span
                    className="text-xs font-medium uppercase tracking-wide"
                    style={{ color: "#86868b" }}
                  >
                    {config.label}
                  </span>
                  {insight.data.dimension && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: config.bgColor, color: config.color }}
                    >
                      {insight.data.dimension}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDismiss(insight.id)}
                  disabled={dismissing === insight.id}
                  className="text-xs font-medium px-3 py-1 rounded-full border transition-colors hover:bg-gray-50 disabled:opacity-50"
                  style={{ color: "#86868b", borderColor: "#d2d2d7" }}
                >
                  {dismissing === insight.id ? "..." : "Noted"}
                </button>
              </div>

              {/* Insight message */}
              <p className="text-sm leading-relaxed mb-3" style={{ color: "#1d1d1f" }}>
                {insight.message}
              </p>

              {/* Agent coaching prompt */}
              {insight.data.agentPrompt && (
                <div
                  className="rounded-lg p-3 text-sm leading-relaxed"
                  style={{ background: "#f5f5f7", color: "#424245" }}
                >
                  <span className="font-medium" style={{ color: "#1d1d1f" }}>
                    Suggested action:{" "}
                  </span>
                  {insight.data.agentPrompt}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function KindIcon({ kind }: { kind: string }) {
  // Simple SVG icons for each mismatch type
  const iconStyle = { width: 16, height: 16, color: "#86868b" }

  if (kind === "BUDGET_DRIFT") {
    return (
      <svg style={iconStyle} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8 1v14M5 4h4.5a2.5 2.5 0 010 5H5M5 9h5a2.5 2.5 0 010 5H5" />
      </svg>
    )
  }

  // Default: arrows diverging (priority drift / hidden priority / contradiction)
  return (
    <svg style={iconStyle} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 2v12M4 6l4-4 4 4M4 10l4 4 4-4" />
    </svg>
  )
}

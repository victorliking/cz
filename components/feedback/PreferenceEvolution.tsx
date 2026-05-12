"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface ComparisonRow {
  dimension: string
  intakeRank: number
  intakeWeight: number
  currentRank: number
  currentWeight: number
  delta: number
  arrow: string
  explanation: string
}

interface PivotalMoment {
  timestamp: string
  trigger: string
  feedbackId: string
  shifts: { dimension: string; delta: number }[]
}

interface EvolutionReport {
  summary: string
  driftScore: number
  driftLabel: string
  comparison: ComparisonRow[]
  pivotalMoments: PivotalMoment[]
  verificationQuestions: string[]
  currentWeights: { dimension: string; weight: number; rank: number; confidence: number }[]
}

export function PreferenceEvolution() {
  const [report, setReport] = useState<EvolutionReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasEnoughData, setHasEnoughData] = useState(false)

  useEffect(() => {
    fetch("/api/preference-evolution")
      .then((r) => r.json())
      .then((data) => {
        setReport(data.report)
        setHasEnoughData(data.hasEnoughData)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="animate-pulse h-32 bg-slate-50 rounded-lg" />

  if (!hasEnoughData || !report) {
    return (
      <div className="border border-dashed rounded-lg p-6 text-center">
        <p className="text-sm text-slate-500">Not enough showing data yet.</p>
        <p className="text-xs text-slate-400 mt-1">
          After a few showings, we&apos;ll show you how your real preferences compare to what you said at intake.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Drift summary banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-blue-800">Preference Evolution</p>
          <DriftBadge score={report.driftScore} label={report.driftLabel} />
        </div>
        <p className="text-sm text-blue-700 leading-relaxed">{report.summary}</p>
      </div>

      {/* Comparison table */}
      {report.comparison.length > 0 && (
        <section>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
            Your Priorities: Then vs Now
          </p>
          <div className="space-y-3">
            {report.comparison.map((row) => (
              <ComparisonRowView key={row.dimension} row={row} />
            ))}
          </div>
        </section>
      )}

      {/* Pivotal moments */}
      {report.pivotalMoments.length > 0 && (
        <section>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
            Key Moments
          </p>
          <div className="space-y-2">
            {report.pivotalMoments.map((moment, i) => (
              <div key={i} className="border rounded-lg p-3 bg-white">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium text-slate-700">{moment.trigger}</p>
                  <span className="text-xs text-slate-400">
                    {new Date(moment.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {moment.shifts.map((shift) => (
                    <span
                      key={shift.dimension}
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        shift.delta > 0
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700"
                      )}
                    >
                      {shift.delta > 0 ? "+" : ""}{(shift.delta * 100).toFixed(0)}% {shift.dimension}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Verification questions */}
      {report.verificationQuestions.length > 0 && (
        <section>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
            Does This Feel Right?
          </p>
          <div className="space-y-2">
            {report.verificationQuestions.map((q, i) => (
              <div key={i} className="border rounded-lg p-3 bg-amber-50 border-amber-200">
                <p className="text-sm text-amber-800">{q}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function DriftBadge({ score, label }: { score: number; label: string }) {
  const pct = Math.min(score * 400, 100)
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-blue-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-blue-600 font-medium">
        {(score * 100).toFixed(0)}%
      </span>
    </div>
  )
}

function ComparisonRowView({ row }: { row: ComparisonRow }) {
  const maxBar = 0.3
  const intakeBarW = Math.min((row.intakeWeight / maxBar) * 100, 100)
  const currentBarW = Math.min((row.currentWeight / maxBar) * 100, 100)

  return (
    <div className="border rounded-lg p-3 bg-white">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-sm font-bold",
            row.arrow === "↑" ? "text-green-600" :
            row.arrow === "↓" ? "text-red-500" :
            "text-slate-400"
          )}>
            {row.arrow}
          </span>
          <span className="text-sm font-medium text-slate-900">{row.dimension}</span>
        </div>
        <span className="text-xs text-slate-500">
          #{row.intakeRank} → #{row.currentRank}
          <span className={cn(
            "ml-2 font-medium",
            row.delta > 0.02 ? "text-green-600" :
            row.delta < -0.02 ? "text-red-500" :
            "text-slate-400"
          )}>
            {row.delta > 0 ? "+" : ""}{(row.delta * 100).toFixed(0)}%
          </span>
        </span>
      </div>

      {/* Weight bars */}
      <div className="space-y-1 my-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 w-12">Intake</span>
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full">
            <div className="h-full bg-slate-300 rounded-full" style={{ width: `${intakeBarW}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-blue-500 w-12">Now</span>
          <div className="flex-1 h-1.5 bg-blue-50 rounded-full">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${currentBarW}%` }} />
          </div>
        </div>
      </div>

      {/* Explanation */}
      {Math.abs(row.delta) >= 0.02 && (
        <p className="text-xs text-slate-500 leading-relaxed">{row.explanation}</p>
      )}
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { ShowingFeedbackForm } from "./ShowingFeedbackForm"

interface FeedbackEntry {
  id: string
  address: string
  date: string
  liked: string
  disliked: string
  verdict: string
  notes: string
  adjustments: string
}

interface AgentFeedbackSectionProps {
  buyerProfileId: string
  initialFeedback: FeedbackEntry[]
}

const verdictStyles: Record<string, string> = {
  love: "bg-green-100 text-green-700",
  like: "bg-blue-100 text-blue-700",
  dislike: "bg-red-100 text-red-700",
  neutral: "bg-slate-100 text-slate-600",
}

export function AgentFeedbackSection({ buyerProfileId, initialFeedback }: AgentFeedbackSectionProps) {
  const [entries, setEntries] = useState<FeedbackEntry[]>(initialFeedback)
  const [showForm, setShowForm] = useState(false)

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Showing Feedback ({entries.length})
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs font-medium text-blue-600 hover:text-blue-800"
        >
          {showForm ? "Cancel" : "+ Log Showing"}
        </button>
      </div>

      {showForm && (
        <div className="mb-4">
          <ShowingFeedbackForm
            buyerProfileId={buyerProfileId}
            onSubmitted={(data) => {
              if (data.entry) {
                setEntries((prev) => [data.entry, ...prev])
              }
              setShowForm(false)
            }}
          />
        </div>
      )}

      {entries.length === 0 && !showForm && (
        <div className="border border-dashed rounded-lg p-6 text-center">
          <p className="text-sm text-slate-400">No showings logged yet.</p>
          <p className="text-xs text-slate-300 mt-1">Click &quot;+ Log Showing&quot; after each visit to train the matching engine.</p>
        </div>
      )}

      {entries.length > 0 && (
        <div className="space-y-3">
          {entries.map((f) => (
            <div key={f.id} className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-slate-900">{f.address}</p>
                <div className="flex items-center gap-2">
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", verdictStyles[f.verdict] || verdictStyles.neutral)}>
                    {f.verdict}
                  </span>
                  <span className="text-xs text-slate-400">{f.date}</span>
                </div>
              </div>
              {f.liked && <p className="text-xs text-green-600">+ {f.liked}</p>}
              {f.disliked && <p className="text-xs text-red-500">- {f.disliked}</p>}
              {f.adjustments && <p className="text-xs text-blue-600 font-medium mt-1">Adjust: {f.adjustments}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

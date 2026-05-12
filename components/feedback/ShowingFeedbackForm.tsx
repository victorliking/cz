"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { FEEDBACK_CHIPS, chipsToKeywordString } from "@/lib/feedback/chip-options"

interface ShowingFeedbackFormProps {
  buyerProfileId?: string
  onSubmitted?: (data: { entry: any; preferenceEvolution: any }) => void
}

const VERDICTS = [
  { key: "love", label: "Loved it", color: "bg-green-500 border-green-500" },
  { key: "like", label: "Interested", color: "bg-blue-500 border-blue-500" },
  { key: "neutral", label: "Neutral", color: "bg-slate-400 border-slate-400" },
  { key: "dislike", label: "Not for us", color: "bg-red-500 border-red-500" },
] as const

export function ShowingFeedbackForm({ buyerProfileId, onSubmitted }: ShowingFeedbackFormProps) {
  const [address, setAddress] = useState("")
  const [verdict, setVerdict] = useState<string>("neutral")
  const [likedChips, setLikedChips] = useState<string[]>([])
  const [dislikedChips, setDislikedChips] = useState<string[]>([])
  const [notes, setNotes] = useState("")
  const [adjustments, setAdjustments] = useState("")
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  const toggleChip = (list: string[], setList: (v: string[]) => void, label: string) => {
    if (list.includes(label)) {
      setList(list.filter((l) => l !== label))
    } else {
      setList([...list, label])
    }
  }

  const handleSubmit = async () => {
    if (!address.trim()) return
    setSaving(true)
    setSuccess(null)

    const body: Record<string, unknown> = {
      address: address.trim(),
      liked: chipsToKeywordString(likedChips),
      disliked: chipsToKeywordString(dislikedChips),
      verdict,
      notes,
      adjustments,
    }
    if (buyerProfileId) body.buyerProfileId = buyerProfileId

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (data.entry) {
        setAddress("")
        setVerdict("neutral")
        setLikedChips([])
        setDislikedChips([])
        setNotes("")
        setAdjustments("")

        if (data.preferenceEvolution) {
          setSuccess(`Saved! Preference drift: ${data.preferenceEvolution.driftLabel}`)
        } else {
          setSuccess("Feedback saved.")
        }

        onSubmitted?.(data)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-slate-50">
      {/* Address */}
      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Address (e.g., 123 Main St, Arlington)"
        className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Verdict */}
      <div>
        <p className="text-xs font-medium text-slate-500 mb-2">Overall reaction</p>
        <div className="flex gap-2">
          {VERDICTS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setVerdict(v.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                verdict === v.key
                  ? `${v.color} text-white`
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Liked chips */}
      <div>
        <p className="text-xs font-medium text-green-600 mb-2">What did they like?</p>
        <div className="flex flex-wrap gap-1.5">
          {FEEDBACK_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => toggleChip(likedChips, setLikedChips, chip.label)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                likedChips.includes(chip.label)
                  ? "bg-green-500 text-white border-green-500"
                  : "bg-white text-slate-600 border-slate-200 hover:border-green-300 hover:bg-green-50"
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Disliked chips */}
      <div>
        <p className="text-xs font-medium text-red-500 mb-2">What didn&apos;t work?</p>
        <div className="flex flex-wrap gap-1.5">
          {FEEDBACK_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => toggleChip(dislikedChips, setDislikedChips, chip.label)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                dislikedChips.includes(chip.label)
                  ? "bg-red-500 text-white border-red-500"
                  : "bg-white text-slate-600 border-slate-200 hover:border-red-300 hover:bg-red-50"
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Additional notes (optional)"
        rows={2}
        className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Adjustments */}
      <textarea
        value={adjustments}
        onChange={(e) => setAdjustments(e.target.value)}
        placeholder="Should we adjust search criteria? (e.g., Need higher ceilings)"
        rows={2}
        className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={saving || !address.trim()}
        className="w-full py-2.5 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors"
      >
        {saving ? "Saving..." : "Save Showing Feedback"}
      </button>

      {/* Success message */}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}
    </div>
  )
}

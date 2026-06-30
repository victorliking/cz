"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { FEEDBACK_CHIPS, chipsToKeywordString } from "@/lib/feedback/chip-options"

interface ShowingFeedbackFormProps {
  buyerProfileId?: string
  /**
   * Per-dimension scores (dimension name → 0-100) for the home being reviewed.
   * Passed straight through to POST /api/feedback so the Bayesian learner can
   * fire its "verdict love/like → boost dimensions scoring ≥70" step. Without
   * this the API receives {} and that learning step never runs.
   */
  listingDimensions?: Record<string, number>
  /** Pre-fill the address (e.g. the listing the buyer picked) and lock editing. */
  presetAddress?: string
  onSubmitted?: (data: { entry: any; preferenceEvolution: any }) => void
}

const VERDICTS = [
  { key: "love", label: "Loved it", color: "bg-green-500 border-green-500" },
  { key: "like", label: "Interested", color: "bg-blue-500 border-blue-500" },
  { key: "neutral", label: "Neutral", color: "bg-slate-400 border-slate-400" },
  { key: "dislike", label: "Not for us", color: "bg-red-500 border-red-500" },
] as const

export function ShowingFeedbackForm({
  buyerProfileId,
  listingDimensions,
  presetAddress,
  onSubmitted,
}: ShowingFeedbackFormProps) {
  const [address, setAddress] = useState(presetAddress ?? "")
  const [verdict, setVerdict] = useState<string>("neutral")
  const [likedChips, setLikedChips] = useState<string[]>([])
  const [dislikedChips, setDislikedChips] = useState<string[]>([])
  const [notes, setNotes] = useState("")
  const [adjustments, setAdjustments] = useState("")
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  // Keep the address in sync when the caller controls it via presetAddress
  // (e.g. the buyer types a free-text address in the picker above this form).
  useEffect(() => {
    if (presetAddress !== undefined) setAddress(presetAddress)
  }, [presetAddress])

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
    // Pass the shown home's dimension scores so the learner can boost the
    // dimensions a loved/liked home actually scored well on.
    if (listingDimensions && Object.keys(listingDimensions).length > 0) {
      body.listingDimensions = listingDimensions
    }

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (data.entry) {
        setAddress(presetAddress ?? "")
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
      {/* Address — locked to a read-only label when the home was pre-selected */}
      {presetAddress ? (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
          <p className="text-xs text-slate-400">Home you saw</p>
          <p className="text-sm font-medium text-slate-900">{presetAddress}</p>
        </div>
      ) : (
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Address (e.g., 123 Main St, Arlington)"
          className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}

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

// --- Buyer-facing "Log a showing" CTA + home picker ---------------------------
//
// A buyer logs feedback against one of their matched homes. Picking a home lets
// us pass that listing's per-dimension scores to the feedback API, which is what
// lets the Bayesian learner reward the dimensions a loved/liked home scored well
// on. The buyer can also log a home that isn't in their match list (free-text
// address); in that case no dimension scores are available and the learner still
// runs off the liked/disliked chips alone.

interface PickerMatch {
  id: string
  address: string
  subtitle: string
  /** dimension name → 0-100, derived from the match engine's dimensionScores. */
  listingDimensions: Record<string, number>
}

/** A match as returned by GET /api/matches (only the fields we read). */
interface RawMatch {
  listing?: { id?: string; address?: string; city?: string }
  dimensionScores?: { dimension?: string; score?: number }[]
}

function toPickerMatches(raw: RawMatch[]): PickerMatch[] {
  return raw
    .filter((m) => m.listing?.id && m.listing?.address)
    .map((m) => {
      const listingDimensions: Record<string, number> = {}
      for (const ds of m.dimensionScores || []) {
        if (ds.dimension && typeof ds.score === "number") {
          listingDimensions[ds.dimension] = ds.score
        }
      }
      return {
        id: m.listing!.id!,
        address: m.listing!.address!,
        subtitle: m.listing!.city || "",
        listingDimensions,
      }
    })
}

export function BuyerLogShowing() {
  const [open, setOpen] = useState(false)
  const [matches, setMatches] = useState<PickerMatch[]>([])
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  // Lazy-load the buyer's matches the first time the panel opens — these power
  // the home picker and carry the dimension scores the learner needs.
  useEffect(() => {
    if (!open || matches.length > 0 || loadingMatches) return
    setLoadingMatches(true)
    fetch("/api/matches")
      .then((r) => r.json())
      .then((d) => setMatches(toPickerMatches(d.matches || [])))
      .catch(() => {})
      .finally(() => setLoadingMatches(false))
  }, [open, matches.length, loadingMatches])

  const selected = matches.find((m) => m.id === selectedId) || null
  const usingOther = selectedId === "__other__"
  const presetAddress = selected?.address
  const listingDimensions = selected?.listingDimensions
  // A matched home is preset (address locked); the "other" path lets the form
  // own an editable address field, so it's always ready to show.
  const canShowForm = Boolean(selected) || usingOther

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-dashed border-[#007AFF]/40 bg-[#007AFF]/[0.04] px-4 py-3.5 text-sm font-medium text-[#007AFF] hover:bg-[#007AFF]/[0.08] transition-colors"
      >
        + Log a showing
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#1d1d1f]">Log a showing</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Tell us how a home felt — we use it to sharpen your matches.
          </p>
        </div>
        <button
          onClick={() => {
            setOpen(false)
            setSelectedId(null)
            setJustSaved(false)
          }}
          className="text-xs font-medium text-slate-400 hover:text-slate-600"
        >
          Close
        </button>
      </div>

      {/* Home picker */}
      {!selected && !usingOther && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500">Which home did you see?</p>
          {loadingMatches ? (
            <div className="animate-pulse h-10 bg-slate-50 rounded-lg" />
          ) : (
            <div className="space-y-1.5">
              {matches.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setSelectedId(m.id)
                    setJustSaved(false)
                  }}
                  className="w-full text-left rounded-lg border border-slate-200 px-3 py-2 hover:border-[#007AFF]/50 hover:bg-[#007AFF]/[0.03] transition-colors"
                >
                  <p className="text-sm font-medium text-slate-900 truncate">{m.address}</p>
                  {m.subtitle && <p className="text-xs text-slate-400">{m.subtitle}</p>}
                </button>
              ))}
              <button
                onClick={() => {
                  setSelectedId("__other__")
                  setJustSaved(false)
                }}
                className="w-full text-left rounded-lg border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-500 hover:border-slate-300 transition-colors"
              >
                A different home (not in my matches)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Change selection */}
      {(selected || usingOther) && !justSaved && (
        <button
          onClick={() => setSelectedId(null)}
          className="text-xs font-medium text-[#007AFF] hover:text-[#0056b3]"
        >
          ← Pick a different home
        </button>
      )}

      {/* The guided chip form — keyed on the selection so switching homes
          resets chips/verdict. For a matched home the address is locked via
          presetAddress; for "other" the form renders its own address field. */}
      {canShowForm && !justSaved && (
        <ShowingFeedbackForm
          key={selectedId || "none"}
          presetAddress={presetAddress}
          listingDimensions={listingDimensions}
          onSubmitted={() => setJustSaved(true)}
        />
      )}

      {/* Saved confirmation */}
      {justSaved && (
        <div className="space-y-3">
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700">
              Thanks — your feedback is in. Your matches will update as we learn.
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedId(null)
              setJustSaved(false)
            }}
            className="text-xs font-medium text-[#007AFF] hover:text-[#0056b3]"
          >
            Log another showing
          </button>
        </div>
      )}
    </div>
  )
}

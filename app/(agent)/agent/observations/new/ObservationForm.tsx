"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"

const LINGERED_OPTIONS = [
  "Kitchen",
  "Natural light",
  "Backyard",
  "Master bedroom",
  "Garage",
  "Basement",
  "Neighborhood",
  "Views",
  "Layout/flow",
  "Finishes",
]

const NEGATIVE_OPTIONS = [
  "Street noise",
  "Small yard",
  "Dark rooms",
  "Dated kitchen",
  "Layout",
  "Parking",
  "Neighbors too close",
  "Too much work needed",
  "Price concerns",
  "Location",
]

const DURATION_OPTIONS = [
  { value: "shorter", label: "Shorter than usual" },
  { value: "average", label: "About average" },
  { value: "longer", label: "Lingered longer than usual" },
]

interface ListingOption {
  id: string
  address: string
  city: string
}

export function ObservationForm() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const buyerId = searchParams.get("buyerId") || ""
  const showingId = searchParams.get("showingId") || ""

  const [listings, setListings] = useState<ListingOption[]>([])
  const [selectedListingId, setSelectedListingId] = useState("")
  const [customAddress, setCustomAddress] = useState("")
  const [showingDate, setShowingDate] = useState(new Date().toISOString().slice(0, 10))
  const [lingeredOn, setLingeredOn] = useState<string[]>([])
  const [reactedNegativelyTo, setReactedNegativelyTo] = useState<string[]>([])
  const [unpromptedQuotes, setUnpromptedQuotes] = useState("")
  const [durationVsAverage, setDurationVsAverage] = useState("average")
  const [agentConfidence, setAgentConfidence] = useState(3)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/listings")
      .then((r) => r.json())
      .then((data) => {
        if (data.listings) setListings(data.listings)
      })
      .catch(() => {})
  }, [])

  function toggleChip(value: string, selected: string[], setSelected: (v: string[]) => void) {
    if (selected.includes(value)) {
      setSelected(selected.filter((v) => v !== value))
    } else {
      setSelected([...selected, value])
    }
  }

  async function handleSubmit() {
    if (!showingId && !selectedListingId && !customAddress.trim()) {
      setError("Select a listing or enter an address")
      return
    }

    setSubmitting(true)
    setError("")

    try {
      const res = await fetch("/api/observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showingId: showingId || undefined,
          buyerProfileId: buyerId,
          listingId: selectedListingId || undefined,
          customAddress: customAddress.trim() || undefined,
          showingDate,
          lingeredOn,
          reactedNegativelyTo,
          unpromptedQuotes: unpromptedQuotes.trim() || null,
          durationVsAverage,
          agentConfidence,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        setError(errData.error || "Failed to save observation")
        return
      }

      setSubmitted(true)
      setTimeout(() => {
        router.push(`/agent/buyers/${buyerId}`)
      }, 1500)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f5f5f7" }}>
        <div className="bg-white rounded-2xl shadow-sm p-10 text-center max-w-md">
          <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold" style={{ color: "#1d1d1f" }}>Observation Recorded</h2>
          <p className="mt-2 text-sm" style={{ color: "#86868b" }}>
            Preference weights have been updated. Redirecting...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8 px-4" style={{ backgroundColor: "#f5f5f7" }}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-sm font-medium mb-4 inline-block"
            style={{ color: "#007AFF" }}
          >
            Back
          </button>
          <h1 className="text-2xl font-bold" style={{ color: "#1d1d1f" }}>
            Record Observation
          </h1>
          <p className="text-sm mt-1" style={{ color: "#86868b" }}>
            Log what you noticed during a showing to improve preference learning.
          </p>
        </div>

        {/* Form */}
        <div className="space-y-8">
          {/* Property Selection (only if no showingId) */}
          {!showingId && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide mb-1" style={{ color: "#1d1d1f" }}>
                Property Shown
              </h2>
              <p className="text-xs mb-4" style={{ color: "#86868b" }}>
                Select from your listings or enter an address manually.
              </p>

              {listings.length > 0 && (
                <select
                  value={selectedListingId}
                  onChange={(e) => {
                    setSelectedListingId(e.target.value)
                    if (e.target.value) setCustomAddress("")
                  }}
                  className="w-full rounded-xl border px-4 py-3 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ borderColor: "#e5e5e7", color: "#1d1d1f" }}
                >
                  <option value="">-- Select a listing --</option>
                  {listings.map((l) => (
                    <option key={l.id} value={l.id}>{l.address}, {l.city}</option>
                  ))}
                </select>
              )}

              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-400">or</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <input
                value={customAddress}
                onChange={(e) => {
                  setCustomAddress(e.target.value)
                  if (e.target.value) setSelectedListingId("")
                }}
                placeholder="Type an address (e.g., 45 Elm St, Arlington)"
                className="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ borderColor: "#e5e5e7", color: "#1d1d1f" }}
              />

              <div className="mt-4">
                <label className="text-xs font-medium" style={{ color: "#86868b" }}>Showing date</label>
                <input
                  type="date"
                  value={showingDate}
                  onChange={(e) => setShowingDate(e.target.value)}
                  className="w-full rounded-xl border px-4 py-3 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ borderColor: "#e5e5e7", color: "#1d1d1f" }}
                />
              </div>
            </div>
          )}

          {/* Lingered On */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-1" style={{ color: "#1d1d1f" }}>
              Lingered On
            </h2>
            <p className="text-xs mb-4" style={{ color: "#86868b" }}>
              What areas or features did the buyer spend extra time exploring?
            </p>
            <div className="flex flex-wrap gap-2">
              {LINGERED_OPTIONS.map((option) => {
                const selected = lingeredOn.includes(option)
                return (
                  <button
                    key={option}
                    onClick={() => toggleChip(option, lingeredOn, setLingeredOn)}
                    className="px-4 py-2 rounded-full text-sm font-medium transition-all"
                    style={{
                      backgroundColor: selected ? "#007AFF" : "#f5f5f7",
                      color: selected ? "#ffffff" : "#1d1d1f",
                      border: selected ? "1px solid #007AFF" : "1px solid #e5e5e7",
                    }}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Reacted Negatively To */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-1" style={{ color: "#1d1d1f" }}>
              Reacted Negatively To
            </h2>
            <p className="text-xs mb-4" style={{ color: "#86868b" }}>
              What made them hesitate, frown, or comment negatively?
            </p>
            <div className="flex flex-wrap gap-2">
              {NEGATIVE_OPTIONS.map((option) => {
                const selected = reactedNegativelyTo.includes(option)
                return (
                  <button
                    key={option}
                    onClick={() => toggleChip(option, reactedNegativelyTo, setReactedNegativelyTo)}
                    className="px-4 py-2 rounded-full text-sm font-medium transition-all"
                    style={{
                      backgroundColor: selected ? "#ff3b30" : "#f5f5f7",
                      color: selected ? "#ffffff" : "#1d1d1f",
                      border: selected ? "1px solid #ff3b30" : "1px solid #e5e5e7",
                    }}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Unprompted Quotes */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-1" style={{ color: "#1d1d1f" }}>
              Unprompted Quotes
            </h2>
            <p className="text-xs mb-4" style={{ color: "#86868b" }}>
              What did the buyer say without being asked? Capture their exact words if possible.
            </p>
            <textarea
              value={unpromptedQuotes}
              onChange={(e) => setUnpromptedQuotes(e.target.value)}
              placeholder={'"I could really see us having dinner parties here..." or "This reminds me of my grandmother\'s house"'}
              rows={4}
              className="w-full rounded-xl border px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ borderColor: "#e5e5e7", color: "#1d1d1f" }}
            />
          </div>

          {/* Duration vs Average */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-1" style={{ color: "#1d1d1f" }}>
              Duration vs. Average
            </h2>
            <p className="text-xs mb-4" style={{ color: "#86868b" }}>
              How long did this showing feel compared to a typical visit?
            </p>
            <div className="flex flex-col gap-2">
              {DURATION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setDurationVsAverage(option.value)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-left transition-all"
                  style={{
                    backgroundColor: durationVsAverage === option.value ? "#f0f7ff" : "#f5f5f7",
                    border: durationVsAverage === option.value ? "1px solid #007AFF" : "1px solid #e5e5e7",
                    color: "#1d1d1f",
                  }}
                >
                  <div
                    className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                    style={{ borderColor: durationVsAverage === option.value ? "#007AFF" : "#86868b" }}
                  >
                    {durationVsAverage === option.value && (
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#007AFF" }} />
                    )}
                  </div>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Agent Confidence */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-1" style={{ color: "#1d1d1f" }}>
              Agent Confidence
            </h2>
            <p className="text-xs mb-4" style={{ color: "#86868b" }}>
              How confident are you this buyer would make an offer on this property?
            </p>
            <div className="flex items-center gap-4">
              <span className="text-xs" style={{ color: "#86868b" }}>Unlikely</span>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={agentConfidence}
                onChange={(e) => setAgentConfidence(parseInt(e.target.value))}
                className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: "#007AFF" }}
              />
              <span className="text-xs" style={{ color: "#86868b" }}>Very likely</span>
            </div>
            <div className="flex justify-between mt-2 px-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setAgentConfidence(n)}
                  className="w-8 h-8 rounded-full text-xs font-semibold flex items-center justify-center transition-all"
                  style={{
                    backgroundColor: agentConfidence === n ? "#007AFF" : "#f5f5f7",
                    color: agentConfidence === n ? "#ffffff" : "#86868b",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-4 rounded-2xl text-base font-semibold transition-all disabled:opacity-50"
            style={{ backgroundColor: "#007AFF", color: "#ffffff" }}
          >
            {submitting ? "Saving..." : "Save Observation"}
          </button>

          <p className="text-center text-xs pb-8" style={{ color: "#86868b" }}>
            This observation carries a 0.9 signal strength — the second-highest weight in preference learning.
          </p>
        </div>
      </div>
    </div>
  )
}

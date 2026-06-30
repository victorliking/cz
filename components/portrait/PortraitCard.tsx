"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import type { BuyerPortrait } from "@/lib/portrait/generate-portrait"
import { ARCHETYPES } from "@/lib/portrait/generate-portrait"
import { useI18n } from "@/lib/i18n/context"
import { PreferenceEvolution } from "@/components/feedback/PreferenceEvolution"
import { STYLE_EXAMPLES } from "@/lib/data/style-examples"

type Tab = "profile" | "criteria" | "evolution" | "log"

export function PortraitCard() {
  const [portrait, setPortrait] = useState<BuyerPortrait | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>("profile")

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

  const tabs: { key: Tab; label: string }[] = [
    { key: "profile", label: "Home Profile" },
    { key: "criteria", label: "Showing Criteria" },
    { key: "evolution", label: "Evolution" },
    { key: "log", label: "Log" },
  ]

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="flex border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === tab.key
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "profile" && <HomeProfile portrait={portrait} />}
      {activeTab === "criteria" && <ShowingCriteria portrait={portrait} />}
      {activeTab === "evolution" && <PreferenceEvolution />}
      {activeTab === "log" && <EvolutionLog />}
    </div>
  )
}

// --- Part 1: Home Profile ---
function HomeProfile({ portrait }: { portrait: BuyerPortrait }) {
  const formatDollar = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`
    if (val >= 1000) return `$${Math.round(val / 1000)}k`
    return `$${val}`
  }

  return (
    <div className="space-y-6">
      {/* Archetype */}
      <ArchetypeSection archetype={portrait.archetype} />

      {/* Ideal home description */}
      <section>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Ideal Home</p>
        <div className="space-y-2 text-sm text-slate-700">
          {portrait.hardFilters.targetCities.length > 0 && (
            <Row label="Neighborhoods" value={portrait.hardFilters.targetCities.join(", ")} />
          )}
          <Row label="Budget" value={`${formatDollar(portrait.budget.comfortable)} – ${formatDollar(portrait.budget.stretch)}`} />
          {portrait.budget.flexibility && (
            <Row label="Flexibility" value={portrait.budget.flexibility} />
          )}
          <Row label="Size" value={`${portrait.hardFilters.minBedrooms}+ BR / ${portrait.hardFilters.minBathrooms}+ BA`} />
          {portrait.hardFilters.propertyTypes.length > 0 && (
            <Row label="Type" value={portrait.hardFilters.propertyTypes.join(", ")} />
          )}
          {portrait.homePreferences?.era && (
            <Row label="Era" value={portrait.homePreferences.era} />
          )}
          {portrait.homePreferences?.features.length > 0 && (
            <Row label="Must-have features" value={portrait.homePreferences.features.join(", ")} />
          )}
          {portrait.homePreferences?.lightPreference && (
            <Row label="Light" value={portrait.homePreferences.lightPreference} />
          )}
          {portrait.lifestyle.renovationAppetite && (
            <Row label="Condition" value={portrait.lifestyle.renovationAppetite} />
          )}
          {portrait.timeline && (
            <Row label="Timeline" value={portrait.timeline} />
          )}
        </div>
      </section>

      {/* Style preferences — visual */}
      {portrait.homePreferences?.styles?.length > 0 && (
        <StylePreferenceVisual styles={portrait.homePreferences.styles} />
      )}

      {/* What defines you */}
      {portrait.prose.length > 0 && (
        <section>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">What Defines You</p>
          <div className="space-y-3">
            {portrait.prose.map((p, i) => (
              <p key={i} className="text-sm text-slate-700 leading-relaxed">{p}</p>
            ))}
          </div>
        </section>
      )}

      {/* Search strategy */}
      <section>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Search Strategy</p>
        <p className="text-sm text-slate-700 leading-relaxed">{portrait.searchStrategy}</p>
      </section>

      {/* Personal Note (AI-generated) */}
      {(portrait as any).personalNote && (
        <section className="pt-4 border-t">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">A Note For You</p>
          <p className="text-sm text-slate-700 leading-relaxed italic bg-blue-50 border border-blue-100 rounded-lg p-3">
            {(portrait as any).personalNote}
          </p>
        </section>
      )}

      {/* Three words */}
      {portrait.freeText?.threeWords && (
        <section className="pt-4 border-t">
          <p className="text-xs text-slate-400 mb-1">In your words</p>
          <p className="text-base text-slate-800 italic">&ldquo;{portrait.freeText.threeWords}&rdquo;</p>
        </section>
      )}
    </div>
  )
}

// --- Part 2: Showing Criteria ---
function ShowingCriteria({ portrait }: { portrait: BuyerPortrait }) {
  // Generate dynamic checklist from portrait data
  const criteria: { category: string; items: string[] }[] = []

  // Location
  const locationItems: string[] = []
  if (portrait.hardFilters.commuteAnchors.length > 0) {
    portrait.hardFilters.commuteAnchors.forEach((c) => {
      locationItems.push(`Commute to ${c}: verify ≤ 30 min`)
    })
  }
  if (portrait.hardFilters.targetCities.length > 0) {
    locationItems.push(`Confirm actual neighborhood matches: ${portrait.hardFilters.targetCities.join(", ")}`)
  }
  if (portrait.dealbreakers.includes("Not walkable — have to drive for everything")) {
    locationItems.push("Walk Score check: grocery, pharmacy within 10 min walk")
  }
  if (locationItems.length > 0) criteria.push({ category: "Location & Commute", items: locationItems })

  // Structure
  const structureItems: string[] = []
  structureItems.push(`Verify ${portrait.hardFilters.minBedrooms}+ bedrooms (check if office/guest room needed)`)
  structureItems.push(`${portrait.hardFilters.minBathrooms}+ bathrooms (note condition of each)`)
  if (portrait.dealbreakers.includes("Bad layout — rooms feel disconnected")) {
    structureItems.push("Test flow: walk from front door → kitchen → living room → yard. Natural?")
  }
  if (portrait.dealbreakers.includes("Not enough space / storage")) {
    structureItems.push("Check closets, basement, attic, garage storage")
  }
  criteria.push({ category: "Space & Layout", items: structureItems })

  // Light & Noise
  const envItems: string[] = []
  if (portrait.dealbreakers.includes("Too dark — not enough natural light")) {
    envItems.push("Check light at 2-4 PM: which rooms get direct sun?")
  }
  if (portrait.dealbreakers.includes("Too noisy — street noise, neighbors")) {
    envItems.push("Noise test: close all windows, stand quietly for 30 seconds. What do you hear?")
    envItems.push("Check proximity to: busy roads, train tracks, schools (recess noise)")
  }
  if (envItems.length > 0) criteria.push({ category: "Light & Environment", items: envItems })

  // Kitchen & Living
  const kitchenItems: string[] = []
  if (portrait.dealbreakers.includes("Kitchen is too small or outdated")) {
    kitchenItems.push("Kitchen: when was it last updated? Layout workable or needs gut reno?")
  }
  if (portrait.lifestyle.hostingStyle?.includes("Big dinner") || portrait.lifestyle.hostingStyle?.includes("Backyard")) {
    kitchenItems.push("Can 6+ people comfortably cook/eat/hang out without blocking each other?")
    kitchenItems.push("Outdoor space: flat, usable, accessible from kitchen/living?")
  }
  if (kitchenItems.length > 0) criteria.push({ category: "Kitchen & Entertaining", items: kitchenItems })

  // Outdoor
  const outdoorItems: string[] = []
  if (portrait.lifestyle.saturdayMorning.includes("Kids playing in the yard") || portrait.lifestyle.saturdayMorning.includes("Walking the dog")) {
    outdoorItems.push("Yard: is it fenced or fenceable? Flat enough for play?")
    outdoorItems.push("Any hazards for kids/pets? (pool without fence, steep drop, busy street)")
  }
  if (portrait.lifestyle.saturdayMorning.includes("Gardening outside")) {
    outdoorItems.push("Sun exposure in yard: south-facing beds? Enough space for garden?")
  }
  if (outdoorItems.length > 0) criteria.push({ category: "Outdoor Space", items: outdoorItems })

  // Red flags
  const redFlags = [
    "Signs of water damage (ceiling stains, musty smell in basement)",
    "Foundation cracks visible inside or outside",
    "Electrical panel: updated to 200A or still old fuses?",
    "Roof age: ask when last replaced (15+ years = budget $15-25k)",
  ]
  criteria.push({ category: "Red Flags to Watch", items: redFlags })

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-400">Use this checklist during every showing. Items are personalized to your priorities.</p>
      {criteria.map((section) => (
        <section key={section.category}>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">{section.category}</p>
          <div className="space-y-1.5">
            {section.items.map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-slate-300 mt-0.5 text-xs">○</span>
                <p className="text-sm text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

// --- Part 3: Evolution Log ---
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

function EvolutionLog() {
  const [entries, setEntries] = useState<FeedbackEntry[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ address: "", liked: "", disliked: "", verdict: "neutral", notes: "", adjustments: "" })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/feedback")
      .then((r) => r.json())
      .then((d) => setEntries(d.entries || []))
      .catch(() => {})
  }, [])

  const handleSubmit = async () => {
    setSaving(true)
    const res = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
    const data = await res.json()
    if (data.entry) {
      setEntries((prev) => [data.entry, ...prev])
      setForm({ address: "", liked: "", disliked: "", verdict: "neutral", notes: "", adjustments: "" })
      setShowForm(false)
    }
    setSaving(false)
  }

  const verdictLabels: Record<string, string> = { love: "Loved it", like: "Interested", neutral: "Neutral", dislike: "Not for us" }

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Showing History</p>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            {showForm ? "Cancel" : "+ Log a showing"}
          </button>
        </div>

        {/* Feedback form */}
        {showForm && (
          <div className="border rounded-lg p-4 space-y-3 mb-4 bg-slate-50">
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Address (e.g., 123 Main St, Arlington)"
              className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm"
            />
            <div className="flex gap-2">
              {(["love", "like", "neutral", "dislike"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setForm({ ...form, verdict: v })}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    form.verdict === v ? "bg-blue-500 text-white border-blue-500" : "bg-white text-slate-600 border-slate-200"
                  )}
                >
                  {verdictLabels[v]}
                </button>
              ))}
            </div>
            <textarea
              value={form.liked}
              onChange={(e) => setForm({ ...form, liked: e.target.value })}
              placeholder="What did you like?"
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm resize-none"
            />
            <textarea
              value={form.disliked}
              onChange={(e) => setForm({ ...form, disliked: e.target.value })}
              placeholder="What didn't work?"
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm resize-none"
            />
            <textarea
              value={form.adjustments}
              onChange={(e) => setForm({ ...form, adjustments: e.target.value })}
              placeholder="Should we adjust search criteria? (e.g., 'Need higher ceilings')"
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm resize-none"
            />
            <button
              onClick={handleSubmit}
              disabled={saving || !form.address}
              className="w-full py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Feedback"}
            </button>
          </div>
        )}

        {/* Entries list */}
        {entries.length === 0 && !showForm && (
          <div className="border border-dashed rounded-lg p-6 text-center">
            <p className="text-sm text-slate-400">No showings logged yet.</p>
            <p className="text-xs text-slate-300 mt-1">Click &quot;+ Log a showing&quot; after each visit.</p>
          </div>
        )}

        {entries.length > 0 && (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div key={entry.id} className="border rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-900">{entry.address}</p>
                  <span className="text-xs text-slate-400">{entry.date}</span>
                </div>
                <span className={cn(
                  "inline-block px-2 py-0.5 rounded-full text-xs font-medium",
                  entry.verdict === "love" ? "bg-green-100 text-green-700" :
                  entry.verdict === "like" ? "bg-blue-100 text-blue-700" :
                  entry.verdict === "dislike" ? "bg-red-100 text-red-700" :
                  "bg-slate-100 text-slate-600"
                )}>
                  {verdictLabels[entry.verdict] || entry.verdict}
                </span>
                {entry.liked && <p className="text-xs text-slate-600"><span className="text-green-600 font-medium">Liked:</span> {entry.liked}</p>}
                {entry.disliked && <p className="text-xs text-slate-600"><span className="text-red-500 font-medium">Didn&apos;t like:</span> {entry.disliked}</p>}
                {entry.adjustments && (
                  <p className="text-xs text-blue-600 font-medium mt-1">Adjustment: {entry.adjustments}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// --- Archetype Section ---
function ArchetypeSection({ archetype }: { archetype: { type: string; headline: string } }) {
  const { locale } = useI18n()
  const [expanded, setExpanded] = useState(false)

  // Find matching archetype info
  const key = Object.keys(ARCHETYPES).find(
    (k) => ARCHETYPES[k].type === archetype.type
  )
  const info = key ? ARCHETYPES[key] : null

  const renderDescription = (text: string) => {
    // Split into paragraphs and render with bold headers
    return text.split("\n\n").map((para, i) => {
      // Check if paragraph starts with **Header:**
      const boldMatch = para.match(/^\*\*(.+?):\*\*\s*(.+)/)
      if (boldMatch) {
        return (
          <div key={i} className="mt-3">
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">{boldMatch[1]}</p>
            <p className="text-sm text-slate-600 leading-relaxed">{boldMatch[2]}</p>
          </div>
        )
      }
      return <p key={i} className="text-sm text-slate-600 leading-relaxed mt-2">{para}</p>
    })
  }

  return (
    <section className="pb-4 border-b">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Your Buyer Type</p>
      <h2 className="text-xl font-bold text-slate-900">
        {info ? (locale === "zh" ? `${info.typeZh} · ${info.type}` : info.type) : archetype.type}
      </h2>
      <p className="text-base text-slate-700 mt-1 font-medium">
        {info ? (locale === "zh" ? info.headlineZh : info.headline) : archetype.headline}
      </p>
      {info && (
        <>
          {!expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Read full profile →
            </button>
          )}
          {expanded && (
            <div className="mt-3 space-y-1">
              {renderDescription(locale === "zh" ? info.descriptionZh : info.description)}
              <button
                onClick={() => setExpanded(false)}
                className="mt-3 text-xs text-slate-400 hover:text-slate-600"
              >
                Collapse
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

// --- Style preferences (visual) ---
function StylePreferenceVisual({ styles }: { styles: string[] }) {
  const { locale } = useI18n()
  // Map style IDs to their visual examples; skip any we don't have a card for.
  const matched = styles
    .map((id) => STYLE_EXAMPLES.find((s) => s.id === id))
    .filter((s): s is (typeof STYLE_EXAMPLES)[number] => Boolean(s))

  // No visual data — fall back to a plain text row so nothing is lost.
  if (matched.length === 0) {
    if (styles.length === 0) return null
    return (
      <section>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Style</p>
        <p className="text-sm text-slate-700">{styles.join(", ")}</p>
      </section>
    )
  }

  return (
    <section>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Style You Love</p>
      <div className="grid grid-cols-3 gap-2">
        {matched.map((style) => (
          <div
            key={style.id}
            className="relative rounded-lg overflow-hidden border border-slate-200 aspect-[4/3] bg-slate-50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={style.photoUrl}
              alt={style.label}
              loading="lazy"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
              <p className="text-white text-xs font-medium leading-tight">
                {locale === "zh" ? style.labelZh : style.label}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// --- Utility ---
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline py-1 border-b border-slate-50">
      <span className="text-slate-500 text-xs uppercase tracking-wide">{label}</span>
      <span className="text-slate-900 font-medium text-sm text-right max-w-[60%]">{value}</span>
    </div>
  )
}

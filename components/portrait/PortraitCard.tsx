"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import type { BuyerPortrait } from "@/lib/portrait/generate-portrait"

type Tab = "profile" | "criteria" | "log"

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
    { key: "log", label: "Evolution Log" },
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
      <section>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Your Buyer Type</p>
        <h2 className="text-xl font-bold text-slate-900">{portrait.archetype.type}</h2>
        <p className="text-sm text-slate-600 mt-1">{portrait.archetype.headline}</p>
      </section>

      {/* Ideal home description */}
      <section>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Ideal Home</p>
        <div className="space-y-2 text-sm text-slate-700">
          {portrait.hardFilters.targetCities.length > 0 && (
            <Row label="Neighborhoods" value={portrait.hardFilters.targetCities.join(", ")} />
          )}
          <Row label="Budget" value={`${formatDollar(portrait.budget.comfortable)} – ${formatDollar(portrait.budget.stretch)}`} />
          <Row label="Size" value={`${portrait.hardFilters.minBedrooms}+ BR / ${portrait.hardFilters.minBathrooms}+ BA`} />
          {portrait.hardFilters.propertyTypes.length > 0 && (
            <Row label="Type" value={portrait.hardFilters.propertyTypes.join(", ")} />
          )}
          {portrait.lifestyle.renovationAppetite && (
            <Row label="Condition" value={portrait.lifestyle.renovationAppetite} />
          )}
        </div>
      </section>

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
function EvolutionLog() {
  // Placeholder for future showing feedback
  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">How This Works</p>
        <p className="text-sm text-slate-600 leading-relaxed">
          After each showing, we&apos;ll log what you liked and didn&apos;t like. Over time, your profile sharpens — 
          we learn not just what you say you want, but what you actually respond to.
        </p>
      </section>

      <section>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Showing History</p>
        <div className="border border-dashed rounded-lg p-6 text-center">
          <p className="text-sm text-slate-400">No showings logged yet.</p>
          <p className="text-xs text-slate-300 mt-1">Your agent will add notes after each visit.</p>
        </div>
      </section>

      <section>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Profile Adjustments</p>
        <p className="text-sm text-slate-500 italic">
          As patterns emerge from your feedback, we&apos;ll automatically update your Home Profile and Showing Criteria.
        </p>
      </section>
    </div>
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

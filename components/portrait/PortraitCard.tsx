"use client"

import { useEffect, useState } from "react"
import type { BuyerPortrait } from "@/lib/portrait/generate-portrait"

// --- Buyer archetype classification (like MBTI) ---
function classifyArchetype(portrait: BuyerPortrait): { type: string; title: string; description: string } {
  const top3 = portrait.priorities.slice(0, 3).map((p) => p.item)
  const lifestyle = portrait.lifestyle.saturdayMorning
  const hosting = portrait.lifestyle.hostingStyle || ""

  // The Nester — family, schools, quiet
  if (
    top3.includes("Schools & family-friendliness") ||
    top3.includes("Privacy & quiet") ||
    lifestyle.includes("Kids playing in the yard") ||
    lifestyle.includes("Walking kids to school")
  ) {
    return {
      type: "The Nester",
      title: "You're building a home for your family to grow into.",
      description:
        "Safety, schools, and a yard for the kids matter more to you than walkability or nightlife. You'll trade trendy for peaceful. The ideal street is one where neighbors know each other's names and kids bike without worry.",
    }
  }

  // The Urbanist — walkability, café, errands
  if (
    top3.includes("Location & commute") ||
    lifestyle.includes("Walking to a café") ||
    lifestyle.includes("Errands nearby on foot")
  ) {
    return {
      type: "The Urbanist",
      title: "You want to walk out the door and have life happen.",
      description:
        "Commute time, walkability, and access to restaurants and shops are your non-negotiables. You'd rather have a smaller home in the right neighborhood than a big one on a cul-de-sac. Convenience is your luxury.",
    }
  }

  // The Entertainer — kitchen, hosting, outdoor space
  if (
    top3.includes("Kitchen & entertaining") ||
    top3.includes("Outdoor space & yard") ||
    hosting.includes("Big dinner parties") ||
    hosting.includes("Backyard BBQs")
  ) {
    return {
      type: "The Entertainer",
      title: "Your home is where people gather.",
      description:
        "A big kitchen, open floor plan, and outdoor space aren't luxuries — they're how you live. You host, you cook, you bring people together. The home needs to flow for a crowd, not just look good empty.",
    }
  }

  // The Light Chaser — natural light, views, finishes
  if (
    top3.includes("Natural light & views") ||
    top3.includes("Finishes & move-in ready") ||
    lifestyle.includes("Coffee & morning light")
  ) {
    return {
      type: "The Light Chaser",
      title: "You feel a home before you see it.",
      description:
        "Morning sun, high ceilings, the way light falls across a room — these things matter to you more than square footage on paper. You'll know the right home the moment you walk in. Aesthetics and ambiance drive your decision.",
    }
  }

  // The Pragmatist — space, value, renovation OK
  if (
    top3.includes("Space & square footage") ||
    portrait.lifestyle.renovationAppetite?.includes("Bring it on") ||
    portrait.lifestyle.renovationAppetite?.includes("Moderate")
  ) {
    return {
      type: "The Pragmatist",
      title: "You see potential where others see problems.",
      description:
        "You're not afraid of work. You'd rather buy below market and build equity through sweat. Layout matters more than finishes because finishes can be changed. You're buying the bones, not the paint.",
    }
  }

  // Default: The Explorer
  return {
    type: "The Explorer",
    title: "You're still discovering what matters most to you.",
    description:
      "You have broad tastes and flexible priorities — that's not a weakness, it's an open mind. As you see homes, your portrait will sharpen. Trust the process: clarity comes from seeing, not just thinking.",
  }
}

function generateProfileParagraph(portrait: BuyerPortrait): string {
  const parts: string[] = []

  // Budget framing
  const formatDollar = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`
    if (val >= 1000) return `$${Math.round(val / 1000)}k`
    return `$${val}`
  }

  parts.push(
    `Your budget puts you in the ${formatDollar(portrait.budget.comfortable)} to ${formatDollar(portrait.budget.stretch)} range.`
  )

  // Priorities
  if (portrait.priorities.length >= 3) {
    parts.push(
      `You value ${portrait.priorities[0].item.toLowerCase()} above all else, followed by ${portrait.priorities[1].item.toLowerCase()} and ${portrait.priorities[2].item.toLowerCase()}.`
    )
  }

  // Dealbreakers
  if (portrait.dealbreakers.length > 0) {
    const top2 = portrait.dealbreakers.slice(0, 2).map((d) => d.toLowerCase().replace(/^too |^not enough |^no /i, ""))
    parts.push(`You won't tolerate ${top2.join(" or ")}.`)
  }

  // Renovation
  if (portrait.lifestyle.renovationAppetite) {
    if (portrait.lifestyle.renovationAppetite.includes("Turn-key")) {
      parts.push("You want move-in ready — no projects, no dust, no contractors.")
    } else if (portrait.lifestyle.renovationAppetite.includes("Bring it on")) {
      parts.push("You're excited by fixer potential and see renovation as opportunity, not burden.")
    }
  }

  return parts.join(" ")
}

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

  if (loading) return <div className="animate-pulse h-64 bg-slate-50 rounded-xl" />
  if (!portrait) return null

  const archetype = classifyArchetype(portrait)
  const profile = generateProfileParagraph(portrait)

  return (
    <div className="space-y-6">
      {/* Archetype Header */}
      <div className="border rounded-xl p-6">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
          Your Buyer Type
        </p>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">{archetype.type}</h2>
        <p className="text-base text-slate-700 font-medium mb-4">{archetype.title}</p>
        <p className="text-sm text-slate-600 leading-relaxed">{archetype.description}</p>
      </div>

      {/* Profile Summary */}
      <div className="border rounded-xl p-6">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
          Your Profile
        </p>
        <p className="text-sm text-slate-700 leading-relaxed">{profile}</p>
      </div>

      {/* Key Signals (compact) */}
      <div className="border rounded-xl p-6">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
          What We'll Optimize For
        </p>
        <div className="space-y-2">
          {portrait.insights.map((insight, idx) => (
            <p key={idx} className="text-sm text-slate-600">{insight}</p>
          ))}
        </div>
      </div>

      {/* Three Words */}
      {portrait.freeText.threeWords && (
        <div className="border rounded-xl p-6 text-center">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
            In Your Words
          </p>
          <p className="text-xl font-medium text-slate-800 italic">
            &ldquo;{portrait.freeText.threeWords}&rdquo;
          </p>
        </div>
      )}
    </div>
  )
}

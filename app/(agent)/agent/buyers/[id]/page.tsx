import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { generatePortrait } from "@/lib/portrait/generate-portrait"
import { ARCHETYPES } from "@/lib/portrait/generate-portrait"
import { notFound } from "next/navigation"
import Link from "next/link"
import { AgentFeedbackSection } from "@/components/feedback/AgentFeedbackSection"
import { InsightsPanel } from "./InsightsPanel"
import { PastObservations } from "@/components/observations/PastObservations"
import { STYLE_EXAMPLES } from "@/lib/data/style-examples"

export const dynamic = "force-dynamic"

export default async function AgentBuyerDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return <p>Not authenticated</p>

  const profile = await prisma.buyerProfile.findUnique({
    where: { id: params.id },
    include: { user: true, intakeResponse: true },
  })

  if (!profile || profile.agentId !== userId) return notFound()

  const answers = (profile.intakeResponse?.answers as Record<string, unknown>) || {}
  const portrait = generatePortrait(answers)

  // Find archetype details
  const archetypeKey = Object.keys(ARCHETYPES).find(
    (k) => ARCHETYPES[k].type === portrait.archetype.type
  )
  const archetypeInfo = archetypeKey ? ARCHETYPES[archetypeKey] : null

  const formatDollar = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`
    if (val >= 1000) return `$${Math.round(val / 1000)}k`
    return `$${val}`
  }

  // Get feedback entries
  const feedback = (answers._feedback || []) as Array<{
    id: string; address: string; date: string; liked: string; disliked: string; verdict: string; notes: string; adjustments: string
  }>

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-400 uppercase tracking-wide">Agent Search Brief</p>
            <h1 className="text-3xl font-bold text-slate-900 mt-1">
              {profile.user.name || profile.user.email || profile.userId}
            </h1>
            <p className="text-slate-500 mt-1">
              {portrait.archetype.type} · {portrait.hardFilters.targetCities.join(", ")} · {portrait.timeline || "No timeline"}
            </p>
          </div>
          <Link
            href={`/agent/observations/new?buyerId=${profile.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors flex-shrink-0"
          >
            Record Observation
          </Link>
        </div>
      </div>

      {/* Quick Reference Card */}
      <div className="bg-slate-50 border rounded-lg p-6 mb-8">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Quick Reference</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-slate-400 text-xs">Budget</p>
            <p className="font-semibold text-slate-900">
              {formatDollar(portrait.budget.comfortable)} – {formatDollar(portrait.budget.stretch)}
            </p>
            {portrait.budget.flexibility && (
              <p className="text-xs text-blue-600">{portrait.budget.flexibility}</p>
            )}
          </div>
          <div>
            <p className="text-slate-400 text-xs">Size</p>
            <p className="font-semibold text-slate-900">{portrait.hardFilters.minBedrooms}+ BR / {portrait.hardFilters.minBathrooms}+ BA</p>
            <p className="text-xs text-slate-500">{portrait.hardFilters.propertyTypes.join(", ")}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs">Style</p>
            <p className="font-semibold text-slate-900">{portrait.homePreferences?.styles.join(", ") || "Any"}</p>
            <p className="text-xs text-slate-500">{portrait.homePreferences?.era || ""}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs">Timeline</p>
            <p className="font-semibold text-slate-900">{portrait.timeline || "Flexible"}</p>
            <p className="text-xs text-slate-500">{portrait.lifestyle.renovationAppetite || ""}</p>
          </div>
        </div>
      </div>

      {/* Style Preferences — Visual */}
      {portrait.homePreferences?.styles.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Style Preferences</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {portrait.homePreferences.styles.map((styleId: string) => {
              const style = STYLE_EXAMPLES.find((s) => s.id === styleId)
              if (!style) return null
              return (
                <div key={styleId} className="relative rounded-xl overflow-hidden border border-slate-200 aspect-[4/3]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={style.photoUrl}
                    alt={style.label}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                    <p className="text-white text-sm font-medium">{style.label}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Behavioral Insights Panel */}
      <InsightsPanel buyerProfileId={profile.id} />

      {/* What to Search For */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Search Strategy</h2>
        <p className="text-sm text-slate-700 leading-relaxed bg-blue-50 border border-blue-100 rounded-lg p-4">
          {portrait.searchStrategy}
        </p>
      </section>

      {/* Priority Ranking — Agent Version */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Priority Weights</h2>
        <div className="space-y-2">
          {portrait.priorities.map((p, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-400 w-4">#{p.rank}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">{p.item}</span>
                  <span className="text-xs text-slate-400">{Math.round(p.weight * 100)}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full mt-1">
                  <div 
                    className="h-1.5 bg-blue-500 rounded-full" 
                    style={{ width: `${p.weight * 400}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Dealbreakers */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Dealbreakers</h2>
        <div className="bg-red-50 border border-red-100 rounded-lg p-4">
          <ul className="space-y-1.5">
            {portrait.dealbreakers.map((d, i) => (
              <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                <span className="text-red-400 mt-0.5">✕</span>
                {d}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Must-Haves */}
      {portrait.homePreferences?.features.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Must-Have Features</h2>
          <div className="flex flex-wrap gap-2">
            {portrait.homePreferences.features.map((f, i) => (
              <span key={i} className="px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-100">
                {f}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Blind Spots — Agent Should Know */}
      {portrait.blindSpots.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Contradictions &amp; Hidden Needs</h2>
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 space-y-3">
            {portrait.blindSpots.map((b, i) => (
              <p key={i} className="text-sm text-amber-800 leading-relaxed">{b}</p>
            ))}
          </div>
        </section>
      )}

      {/* Commute Anchors */}
      {portrait.hardFilters.commuteAnchors.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Commute Anchors</h2>
          <ul className="space-y-1">
            {portrait.hardFilters.commuteAnchors.map((c, i) => (
              <li key={i} className="text-sm text-slate-700">→ {c}</li>
            ))}
          </ul>
          <p className="text-xs text-slate-400 mt-2">Verify all listings are ≤ 30 min from both.</p>
        </section>
      )}

      {/* Budget by City */}
      {portrait.budget.cities.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Max Price by City</h2>
          <div className="grid grid-cols-3 gap-3">
            {portrait.budget.cities.map((c, i) => (
              <div key={i} className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                <p className="text-lg font-bold text-slate-900">{formatDollar(c.maxPrice)}</p>
                <p className="text-xs text-slate-400">Tax: ${c.taxRate}/1000</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Buyer's Own Words */}
      {(portrait.freeText?.threeWords || portrait.freeText?.notes) && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">In Their Own Words</h2>
          <div className="bg-slate-50 rounded-lg p-4">
            {portrait.freeText.threeWords && (
              <p className="text-sm text-slate-800 italic">&ldquo;{portrait.freeText.threeWords}&rdquo;</p>
            )}
            {portrait.freeText.notes && (
              <p className="text-sm text-slate-600 mt-2">{portrait.freeText.notes}</p>
            )}
          </div>
        </section>
      )}

      {/* Agent Observations — past recorded observations from showings */}
      <PastObservations buyerProfileId={profile.id} />

      {/* Showing Feedback — chip-based form + history */}
      <AgentFeedbackSection buyerProfileId={profile.id} initialFeedback={feedback} />

      {/* Archetype Deep Dive (collapsed by default for agents who want to understand mindset) */}
      {archetypeInfo && (
        <details className="mb-8">
          <summary className="text-sm font-semibold text-slate-700 uppercase tracking-wide cursor-pointer hover:text-slate-900">
            Buyer Psychology: {archetypeInfo.type} ({archetypeInfo.typeZh})
          </summary>
          <div className="mt-3 bg-slate-50 rounded-lg p-4">
            <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">
              {archetypeInfo.description}
            </p>
          </div>
        </details>
      )}
    </div>
  )
}

/**
 * Test Script: Preference Evolution Demo
 * 
 * Simulates a buyer who:
 * 1. Fills out intake questionnaire (prior)
 * 2. Sees 5 houses and gives feedback
 * 3. Shows how weights evolve with each showing
 * 4. Generates a preference drift report for verification
 * 
 * Run: npx ts-node --skip-project scripts/test-preference-evolution.ts
 */

import {
  initializeFromIntake,
  updateWeights,
  extractSignalsFromFeedback,
  type FeedbackSignal,
  type PreferenceState,
} from '../lib/scoring/bayesian-learner'
import { generatePreferenceReport, formatReportAsText } from '../lib/scoring/preference-report'

// --- Simulated Buyer: "Sarah" ---
// Intake: Says she cares most about commute + schools
// Reality: After showings, natural light & kitchen matter more than she thought

const INTAKE_PRIORITIES = [
  { item: "Location & commute", rank: 1, weight: 0.25 },
  { item: "Schools & family-friendliness", rank: 2, weight: 0.20 },
  { item: "Space & square footage", rank: 3, weight: 0.16 },
  { item: "Natural light & views", rank: 4, weight: 0.13 },
  { item: "Outdoor space & yard", rank: 5, weight: 0.10 },
  { item: "Kitchen & entertaining", rank: 6, weight: 0.07 },
  { item: "Privacy & quiet", rank: 7, weight: 0.05 },
  { item: "Finishes & move-in ready", rank: 8, weight: 0.04 },
]

// --- Simulated Showings ---

const SHOWINGS = [
  {
    name: "42 Maple Street, Cambridge",
    listingId: "listing_001",
    // Great commute + schools, but dark and small kitchen
    listingDimensions: {
      "Location & commute": 90,
      "Schools & family-friendliness": 85,
      "Space & square footage": 70,
      "Natural light & views": 30,  // dark!
      "Kitchen & entertaining": 35,  // tiny galley
      "Outdoor space & yard": 60,
      "Privacy & quiet": 70,
      "Finishes & move-in ready": 60,
    },
    feedback: {
      liked: "great location, walkable, close to school",
      disliked: "dark rooms, kitchen too small, felt cramped",
      verdict: "like" as const,
    },
  },
  {
    name: "18 Oak Avenue, Somerville",
    listingId: "listing_002",
    // Bright and open kitchen, but longer commute
    listingDimensions: {
      "Location & commute": 55,
      "Schools & family-friendliness": 65,
      "Space & square footage": 80,
      "Natural light & views": 95,  // incredible light!
      "Kitchen & entertaining": 90,  // amazing kitchen
      "Outdoor space & yard": 50,
      "Privacy & quiet": 60,
      "Finishes & move-in ready": 85,
    },
    feedback: {
      liked: "SO BRIGHT! incredible natural light, kitchen is a dream, open layout, modern finishes",
      disliked: "commute is longer, school district average",
      verdict: "love" as const,
    },
  },
  {
    name: "7 Birch Lane, Arlington",
    listingId: "listing_003",
    // Good schools, decent light, boring kitchen
    listingDimensions: {
      "Location & commute": 60,
      "Schools & family-friendliness": 95,
      "Space & square footage": 85,
      "Natural light & views": 65,
      "Kitchen & entertaining": 40,
      "Outdoor space & yard": 80,
      "Privacy & quiet": 85,
      "Finishes & move-in ready": 50,
    },
    feedback: {
      liked: "great yard, quiet street, spacious rooms",
      disliked: "kitchen is dated, feels dark compared to Oak Ave",
      verdict: "neutral" as const,
    },
  },
  {
    name: "201 Main St Unit 3, Cambridge",
    listingId: "listing_004",
    // Walkable condo, beautiful but no yard
    listingDimensions: {
      "Location & commute": 95,
      "Schools & family-friendliness": 60,
      "Space & square footage": 50,
      "Natural light & views": 85,
      "Kitchen & entertaining": 75,
      "Outdoor space & yard": 10,
      "Privacy & quiet": 40,
      "Finishes & move-in ready": 90,
    },
    feedback: {
      liked: "love the light, great kitchen, walk to everything",
      disliked: "too small, no yard for kids, noisy street",
      verdict: "like" as const,
    },
  },
  {
    name: "55 Elm Street, Medford",
    listingId: "listing_005",
    // Agent observation: buyer lingered in the kitchen for 10 minutes
    listingDimensions: {
      "Location & commute": 45,
      "Schools & family-friendliness": 70,
      "Space & square footage": 90,
      "Natural light & views": 80,
      "Kitchen & entertaining": 95,
      "Outdoor space & yard": 75,
      "Privacy & quiet": 80,
      "Finishes & move-in ready": 70,
    },
    feedback: {
      liked: "incredible kitchen island, light-filled, could see ourselves cooking here, entertaining space",
      disliked: "commute would be tough, far from Kendall",
      verdict: "love" as const,
    },
  },
]

// --- Run Simulation ---

function main() {
  console.log("\n🧪 PREFERENCE EVOLUTION SIMULATION")
  console.log("=" .repeat(60))
  console.log("\n📋 Buyer: Sarah")
  console.log("   Stated priorities at intake:")
  for (const p of INTAKE_PRIORITIES) {
    console.log(`   #${p.rank} ${p.item} (${(p.weight * 100).toFixed(0)}%)`)
  }

  // Initialize from intake
  let state: PreferenceState = initializeFromIntake(INTAKE_PRIORITIES)

  console.log("\n\n🏠 SIMULATING 5 SHOWINGS...")
  console.log("-".repeat(60))

  for (let i = 0; i < SHOWINGS.length; i++) {
    const showing = SHOWINGS[i]
    console.log(`\n--- Showing ${i + 1}: ${showing.name} ---`)
    console.log(`    Liked: ${showing.feedback.liked}`)
    console.log(`    Disliked: ${showing.feedback.disliked}`)
    console.log(`    Verdict: ${showing.feedback.verdict.toUpperCase()}`)

    // Extract signals from feedback
    const dimensionSignals = extractSignalsFromFeedback({
      ...showing.feedback,
      listingDimensions: showing.listingDimensions,
    })

    // Determine signal source (most feedback is FEEDBACK_CHIPS level)
    // For showing #5, simulate agent observation (higher trust)
    const source = i === 4 ? "AGENT_OBSERVATION" : "FEEDBACK_CHIPS"

    const signal: FeedbackSignal = {
      source: source as any,
      dimensionSignals,
      listingId: showing.listingId,
      listingDimensions: showing.listingDimensions,
      timestamp: new Date(Date.now() - (5 - i) * 86400000).toISOString(),
    }

    // Update weights
    const { newState, changes } = updateWeights(state, signal)
    state = newState

    if (changes.length > 0) {
      console.log(`    📊 Weight changes:`)
      for (const change of changes) {
        const arrow = change.delta > 0 ? "↑" : "↓"
        console.log(`       ${arrow} ${change.dimension}: ${(change.oldWeight * 100).toFixed(1)}% → ${(change.newWeight * 100).toFixed(1)}% (${change.reason})`)
      }
    } else {
      console.log(`    📊 No significant weight changes`)
    }
  }

  // Generate final preference report
  console.log("\n\n")
  const report = generatePreferenceReport(state)
  console.log(formatReportAsText(report))

  // Show current vs intake comparison
  console.log("\n\n📊 FINAL WEIGHT COMPARISON:")
  console.log("-".repeat(60))
  console.log(`${"Dimension".padEnd(30)} ${"Intake".padEnd(10)} ${"Evolved".padEnd(10)} ${"Δ".padEnd(8)} Confidence`)
  console.log("-".repeat(75))

  const sortedCurrent = [...state.current].sort((a, b) => b.weight - a.weight)
  for (const dw of sortedCurrent) {
    const prior = state.prior.find(p => p.dimension === dw.dimension)!
    const delta = dw.weight - prior.weight
    const deltaStr = delta > 0 ? `+${(delta * 100).toFixed(1)}%` : `${(delta * 100).toFixed(1)}%`
    const confBar = "█".repeat(Math.round(dw.confidence * 10)) + "░".repeat(10 - Math.round(dw.confidence * 10))
    console.log(
      `${dw.dimension.padEnd(30)} ${(prior.weight * 100).toFixed(1).padEnd(10)}% ${(dw.weight * 100).toFixed(1).padEnd(10)}% ${deltaStr.padEnd(8)} ${confBar} ${(dw.confidence * 100).toFixed(0)}%`
    )
  }

  console.log("\n\n✅ This report would be shown to the buyer for verification.")
  console.log("   If they confirm, these evolved weights are used for future matching.")
  console.log("   If they disagree, they can manually adjust and we update the prior.\n")
}

main()

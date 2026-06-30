/**
 * Test script: Generate AI portrait from mock buyer answers via the real
 * generateAINarrative() path (Claude Sonnet 4.6 on Bedrock).
 * Run: npx tsx scripts/test-ai-portrait.ts
 */

import { generateAINarrative } from "../lib/portrait/ai-portrait"

const MOCK_ANSWERS = {
  // Step 1: Who's moving
  household: "couple_with_kids",
  kids_ages: "3, 6",
  pets: "dog",
  
  // Step 2: Target areas
  target_areas: ["Arlington", "Belmont", "Watertown"],
  
  // Step 3: Budget
  budget: {
    budgetRange: [900000, 1300000],
    flexibility: "可以多加5-10%如果学区特别好",
    monthlyComfort: 5500,
  },
  
  // Step 4: Priority ranking
  priorities: [
    "Schools & family-friendliness",
    "Privacy & quiet",
    "Natural light & views",
    "Location & commute",
    "Outdoor space & yard",
    "Space & square footage",
    "Kitchen & entertaining",
    "Finishes & move-in ready",
  ],
  
  // Step 5: Scenarios
  scenario_commute: "accept_longer_commute_for_better_schools",
  scenario_budget: "stretch_budget_for_right_neighborhood",
  scenario_condition: "prefer_move_in_ready_pay_more",
  
  // Step 6: Pain points (current home)
  pain_points: ["Too noisy — street noise, neighbors", "Not enough natural light", "Kitchen is too small or outdated"],
  pain_detail: "我们现在住Somerville的公寓，楼上邻居太吵了，而且朝北完全没有阳光。厨房只能一个人站。",
  
  // Step 7: Saturday morning
  saturday_morning: ["Kids playing in the yard", "Making breakfast in a big kitchen", "Reading by the window with coffee"],
  
  // Step 8: Hosting style
  hosting_style: ["Big dinner parties (8+ people)", "Kids playdates"],
  
  // Step 9: Home style
  home_styles: ["Colonial", "Craftsman"],
  home_era: "Updated classic (old bones, modern kitchen/bath)",
  
  // Step 10: Features
  must_have_features: ["Hardwood floors", "Central AC", "Home office space", "Fenced yard"],
  nice_to_have: ["Fireplace", "Mudroom", "Finished basement"],
  
  // Step 11: Light preference
  light_preference: "Bright and sunny — south/west facing",
  
  // Step 12: Renovation appetite
  renovation_appetite: "Cosmetic OK (paint, fixtures) but no major work",
  
  // Step 13: Commute anchors
  commute_anchors: ["Kendall Square (spouse)", "Longwood Medical Area (me)"],
  commute_max: 30,
  commute_mode: "drive",
  
  // Step 14: Timeline
  timeline: "3-6 months",
  urgency: "Flexible but motivated",
  
  // Step 15: Dealbreakers
  dealbreakers: [
    "Too noisy — street noise, neighbors",
    "Too dark — not enough natural light", 
    "Kitchen is too small or outdated",
    "Not walkable — have to drive for everything",
  ],
  
  // Step 16: Three words
  three_words: "明亮、安静、有生活气息",
  
  // Step 17: Free notes
  free_notes: "我们第一个孩子明年要上K，所以学区是最重要的。但我不想住在那种特别suburb没有生活气息的地方。理想的是走路能到一个小商业街买杯咖啡。老公在Kendall上班，我在Longwood，所以两边通勤都不能太远。",
  
  // Step 18: Flexibility
  budget_stretch_for: "学区和安静程度",
  willing_to_compromise: "面积可以小一点，不需要很大的院子，但要有",
}

async function main() {
  console.log("🧠 Generating AI portrait with Claude Sonnet 4.6 (Bedrock)...\n")
  console.log("Mock buyer: Young Chinese-American couple, 2 kids, $900k-$1.3M, Arlington/Belmont area\n")
  console.log("---\n")

  const result = await generateAINarrative(MOCK_ANSWERS, "zh")

  if (!result) {
    console.error("❌ generateAINarrative returned null — Bedrock call failed (check AWS creds / model access).")
    process.exit(1)
  }

  console.log("═══════════════════════════════════════════")
  console.log("         📋 AI BUYER PORTRAIT")
  console.log("═══════════════════════════════════════════\n")

  console.log("── WHAT DEFINES YOU ──\n")
  result.prose.forEach((p: string) => {
    console.log(`  ${p}\n`)
  })

  console.log("\n── BLIND SPOTS (你可能没意识到的) ──\n")
  result.blindSpots.forEach((b: string) => {
    console.log(`  ⚠️  ${b}\n`)
  })

  console.log("\n── SEARCH STRATEGY ──\n")
  console.log(`  🎯 ${result.searchStrategy}\n`)

  console.log("\n── A NOTE FOR YOU ──\n")
  console.log(`  💬 ${result.personalNote}\n`)

  console.log("\n═══════════════════════════════════════════")
  console.log("Raw JSON output:")
  console.log(JSON.stringify(result, null, 2))
}

main().catch(console.error)

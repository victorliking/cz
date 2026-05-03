/**
 * Test script: Generate AI portrait from mock buyer answers using Opus
 * Run: npx tsx scripts/test-ai-portrait.ts
 */

import Anthropic from "@anthropic-ai/sdk"

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
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  console.log("🧠 Generating AI portrait with Claude Opus...\n")
  console.log("Mock buyer: Young Chinese-American couple, 2 kids, $900k-$1.3M, Arlington/Belmont area\n")
  console.log("---\n")

  const response = await client.messages.create({
    model: "claude-opus-4-20250514",
    max_tokens: 2000,
    temperature: 0.7,
    system: `You are a world-class real estate psychologist and buyer advisor. You analyze home buyer questionnaire responses to generate deeply personalized insights that make buyers feel truly understood.

Your output style:
- Conversational but sharp — like a brilliant friend who happens to know real estate
- Mix emotional resonance ("you want a place that feels like exhaling") with hard data ("that means south-facing, 1800+ sqft, sub-$1.2M in Arlington")
- Call out contradictions gently but clearly — buyers need to hear what they're not seeing
- Be specific to Greater Boston market knowledge when relevant
- Never be generic — every sentence should reference something specific from their answers

Output language: Chinese (Simplified) since the buyer used Chinese in their free-text answers.

You MUST respond with ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "prose": ["paragraph1", "paragraph2", "paragraph3"],
  "blindSpots": ["insight1", "insight2", "insight3"],
  "searchStrategy": "one paragraph describing exactly what to search for",
  "personalNote": "a short 1-2 sentence note that feels deeply personal"
}`,
    messages: [
      {
        role: "user",
        content: `Here are the complete questionnaire answers from a home buyer in the Greater Boston area:\n\n${JSON.stringify(MOCK_ANSWERS, null, 2)}\n\nThis buyer filled out the questionnaire mixing Chinese and English. Generate your response in Chinese.\n\nAnalyze deeply. Look for contradictions between priority ranking and scenario answers, hidden needs from pain points + lifestyle choices, and anything their free-text reveals that structured questions missed.\n\nRespond with ONLY the JSON object, no other text.`,
      },
    ],
  })

  const text = response.content[0].type === "text" ? response.content[0].text : ""
  
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0])
      
      console.log("═══════════════════════════════════════════")
      console.log("         📋 AI BUYER PORTRAIT")
      console.log("═══════════════════════════════════════════\n")
      
      console.log("── WHAT DEFINES YOU ──\n")
      result.prose.forEach((p: string, i: number) => {
        console.log(`  ${p}\n`)
      })
      
      console.log("\n── BLIND SPOTS (你可能没意识到的) ──\n")
      result.blindSpots.forEach((b: string, i: number) => {
        console.log(`  ⚠️  ${b}\n`)
      })
      
      console.log("\n── SEARCH STRATEGY ──\n")
      console.log(`  🎯 ${result.searchStrategy}\n`)
      
      console.log("\n── A NOTE FOR YOU ──\n")
      console.log(`  💬 ${result.personalNote}\n`)
      
      console.log("\n═══════════════════════════════════════════")
      console.log("Raw JSON output:")
      console.log(JSON.stringify(result, null, 2))
    } else {
      console.log("Raw response:", text)
    }
  } catch (e) {
    console.log("Parse error. Raw response:")
    console.log(text)
  }
}

main().catch(console.error)

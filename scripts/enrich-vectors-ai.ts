/**
 * Backfill AI-derived soft dimensions into existing listings' `vector`.
 *
 * Matching stays fast/deterministic (it just reads vector scores); this script
 * runs the expensive per-listing AI extraction OFFLINE, in batch, and writes the
 * results so the match engine has real light/noise/kitchen/etc. scores to
 * differentiate on (instead of everyone landing at ~100% on schools+sqft alone).
 *
 * Only fills dimensions that are currently null (never overwrites an
 * agent-provided score). Honest: a dimension the description doesn't support
 * stays null. Grounded + graceful (aiDeriveVector returns null on no credential).
 *
 *   # dry run, first 5:
 *   AWS_BEARER_TOKEN_BEDROCK=... AWS_REGION=us-west-2 npx tsx scripts/enrich-vectors-ai.ts --dry-run --limit 5
 *   # real, up to 200 active listings that still lack soft scores:
 *   AWS_BEARER_TOKEN_BEDROCK=... AWS_REGION=us-west-2 npx tsx scripts/enrich-vectors-ai.ts --limit 200
 */
import { prisma } from "@/lib/prisma"
import { aiDeriveVector } from "@/lib/mls/ai-derive-vector"

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")
const limitArg = args.indexOf("--limit")
const LIMIT = limitArg >= 0 ? parseInt(args[limitArg + 1], 10) || 50 : 50

// vector key names (aiDeriveVector uses `privacy`; the stored vector uses
// `privacy_from_neighbors`). Map derived → stored keys.
const KEY_MAP: Record<string, string> = {
  natural_light: "natural_light",
  noise_level: "noise_level",
  openness: "openness",
  privacy: "privacy_from_neighbors",
  kitchen_quality: "kitchen_quality",
  move_in_readiness: "move_in_readiness",
  yard_usability: "yard_usability",
}

async function main() {
  const listings = await prisma.listing.findMany({
    where: { status: "ACTIVE", NOT: { agentNotes: null } },
    select: { id: true, address: true, agentNotes: true, vector: true },
    take: LIMIT,
  })

  console.log(`${dryRun ? "[DRY RUN] " : ""}Enriching up to ${listings.length} listings...\n`)
  let enriched = 0, skipped = 0, filledTotal = 0

  for (const l of listings) {
    const vector = (l.vector as Record<string, any>) || {}
    const derived = await aiDeriveVector(l.agentNotes)
    if (!derived) { skipped++; continue }

    const filled: string[] = []
    for (const [dKey, storedKey] of Object.entries(KEY_MAP)) {
      const val = (derived as any)[dKey]
      // Only fill when we have a value AND the stored slot is empty (don't
      // overwrite agent-provided data).
      if (typeof val === "number" && vector[storedKey] == null) {
        vector[storedKey] = val
        filled.push(`${storedKey}=${val}`)
      }
    }
    // Tag provenance so it's clear these came from AI, not an agent walkthrough.
    if (filled.length > 0) vector._aiDerivedAt = new Date().toISOString()

    if (filled.length === 0) { skipped++; continue }
    console.log(`  ${l.address}: ${filled.join(", ")}`)
    filledTotal += filled.length
    enriched++

    if (!dryRun) {
      await prisma.listing.update({ where: { id: l.id }, data: { vector } })
    }
  }

  console.log(`\n${dryRun ? "[DRY RUN] would enrich" : "Enriched"} ${enriched} listings (${filledTotal} dimension values), skipped ${skipped}.`)
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error("ERROR:", e.message); prisma.$disconnect(); process.exit(1) })

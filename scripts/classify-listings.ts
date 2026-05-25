/**
 * Batch classify listing photos using AI vision.
 *
 * Processes all listings that don't have style_tags yet.
 * Runs sequentially to respect API rate limits.
 *
 * Usage:
 *   npx tsx scripts/classify-listings.ts
 *   npx tsx scripts/classify-listings.ts --limit 10    # Only process 10
 *   npx tsx scripts/classify-listings.ts --dry-run     # Preview without saving
 */

import { prisma } from "../lib/prisma"
import { classifyStyle } from "../lib/vision/classify-style"

const args = process.argv.slice(2)
const limit = getArgValue("--limit") ? parseInt(getArgValue("--limit")!) : undefined
const dryRun = args.includes("--dry-run")

function getArgValue(flag: string): string | null {
  const idx = args.indexOf(flag)
  if (idx === -1 || idx + 1 >= args.length) return null
  return args[idx + 1]
}

async function main() {
  console.log("Style Classification — Batch Processor")
  console.log("=======================================")
  console.log()

  const listings = await prisma.listing.findMany({
    where: {
      status: "ACTIVE",
      photos: { isEmpty: false },
    },
    select: {
      id: true,
      address: true,
      city: true,
      photos: true,
      vector: true,
    },
    ...(limit ? { take: limit } : {}),
    orderBy: { createdAt: "desc" },
  })

  // Filter to those without style_tags
  const unclassified = listings.filter((l) => {
    const vector = l.vector as any
    return !vector?.style_tags
  })

  console.log(`Total active listings: ${listings.length}`)
  console.log(`Already classified: ${listings.length - unclassified.length}`)
  console.log(`To classify: ${unclassified.length}`)
  console.log(`Dry run: ${dryRun}`)
  console.log()

  if (unclassified.length === 0) {
    console.log("Nothing to do.")
    return
  }

  let success = 0
  let failed = 0
  const startTime = Date.now()

  for (let i = 0; i < unclassified.length; i++) {
    const listing = unclassified[i]
    const photoUrl = listing.photos[0]

    if (!photoUrl) {
      console.log(`  [${i + 1}/${unclassified.length}] SKIP (no photo): ${listing.address}`)
      continue
    }

    console.log(`  [${i + 1}/${unclassified.length}] Classifying: ${listing.address}, ${listing.city}`)

    try {
      const result = await classifyStyle(photoUrl)

      if (result) {
        if (!dryRun) {
          const vector = (listing.vector as any) || {}
          await prisma.listing.update({
            where: { id: listing.id },
            data: {
              vector: { ...vector, style_tags: result },
            },
          })
        }
        console.log(`           -> ${result.architectural_style.join(", ")} | ${result.era_feel} | ${result.overall_vibe.join(", ")}`)
        success++
      } else {
        console.log(`           -> FAILED (null result)`)
        failed++
      }
    } catch (err) {
      console.log(`           -> ERROR: ${err instanceof Error ? err.message : String(err)}`)
      failed++
    }

    // Brief pause between calls to be respectful of rate limits
    if (i < unclassified.length - 1) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000)
  console.log()
  console.log("=======================================")
  console.log(`Done in ${elapsed}s`)
  console.log(`  Success: ${success}`)
  console.log(`  Failed:  ${failed}`)
  console.log(`  Skipped: ${unclassified.length - success - failed}`)
}

main()
  .catch((err) => {
    console.error("Fatal:", err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

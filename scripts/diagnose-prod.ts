/**
 * READ-ONLY production diagnostic. Makes ZERO writes — only counts/reads.
 *
 * Run against prod by passing the prod DATABASE_URL inline (get it from the
 * Neon dashboard or Vercel project settings → Environment Variables):
 *
 *   DATABASE_URL="postgresql://...neon.tech/...?sslmode=require" npx tsx scripts/diagnose-prod.ts
 *
 * It answers: the buyer-list/identity bug, whether listings have photos, and
 * how stale the listing data is.
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("=== USERS / AGENTS ===")
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true },
    orderBy: { createdAt: "asc" },
  })
  for (const u of users) console.log(`  ${u.role.padEnd(6)} ${u.id}  ${u.email}`)

  console.log("\n=== BUYER PROFILES (who owns them) ===")
  const profiles = await prisma.buyerProfile.findMany({
    select: { id: true, agentId: true, status: true, intakeCompletedAt: true, user: { select: { email: true } } },
  })
  console.log(`  total buyer profiles: ${profiles.length}`)
  const byAgent = new Map<string, number>()
  for (const p of profiles) byAgent.set(p.agentId, (byAgent.get(p.agentId) || 0) + 1)
  for (const [agentId, n] of byAgent) {
    const owner = users.find((u) => u.id === agentId)
    console.log(`    agentId ${agentId} owns ${n} buyer(s)  ${owner ? `→ ${owner.email} (${owner.role})` : "→ ⚠️ NO MATCHING USER (orphaned agentId — likely the token.id vs token.sub bug)"}`)
  }
  for (const p of profiles) {
    console.log(`    • ${p.user?.email ?? "?"}  status=${p.status}  intakeCompletedAt=${p.intakeCompletedAt ? "set" : "NULL"}`)
  }

  console.log("\n=== LISTINGS: count / photos / freshness ===")
  const total = await prisma.listing.count()
  const active = await prisma.listing.count({ where: { status: "ACTIVE" } })
  const withPhotos = await prisma.listing.count({ where: { NOT: { photos: { isEmpty: true } } } })
  const junkZero = await prisma.listing.count({ where: { listPrice: 0 } })
  console.log(`  total=${total}  active=${active}  withPhotos=${withPhotos}  listPrice==0 (junk?)=${junkZero}`)

  const newest = await prisma.listing.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } })
  const oldest = await prisma.listing.findFirst({ orderBy: { updatedAt: "asc" }, select: { updatedAt: true } })
  console.log(`  data freshness: newest updatedAt=${newest?.updatedAt?.toISOString() ?? "n/a"}  oldest=${oldest?.updatedAt?.toISOString() ?? "n/a"}`)

  console.log("\n=== the specific listing you opened ===")
  const one = await prisma.listing.findUnique({
    where: { id: "cmpj6fvyu0125tnir6p3emtcd" },
    select: { id: true, address: true, city: true, status: true, listPrice: true, photos: true, agentNotes: true, listingUrl: true, agentId: true },
  })
  if (!one) console.log("  NOT FOUND")
  else
    console.log({
      ...one,
      photoCount: one.photos?.length ?? 0,
      firstPhoto: one.photos?.[0] ?? null,
      agentNotesPreview: one.agentNotes?.slice(0, 80) ?? null,
    })

  console.log("\n=== INSIGHTS (dashboard hardcodes 0) ===")
  const insights = await prisma.insightLog.count()
  const undismissed = await prisma.insightLog.count({ where: { dismissedAt: null } })
  console.log(`  InsightLog total=${insights}  undismissed=${undismissed}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("ERROR:", e.message)
    prisma.$disconnect()
    process.exit(1)
  })

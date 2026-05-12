/**
 * MLS PIN Data Import Script
 * 
 * Downloads IDX flat files from MLS PIN and imports them into the database.
 * 
 * Usage:
 *   npx tsx scripts/import-mls.ts                    # Full import (all active SF)
 *   npx tsx scripts/import-mls.ts --dry-run          # Preview without DB writes
 *   npx tsx scripts/import-mls.ts --towns Arlington,Belmont,Watertown
 *   npx tsx scripts/import-mls.ts --preview 5        # Show first 5 mapped listings
 * 
 * Prerequisites:
 *   1. Download IDX files from mlspin.com → IDX Downloads
 *   2. Place files in data/mls/ directory:
 *      - PALL.txt (required)
 *      - SF.txt (required for single family)
 *      - Towns.txt (required for city name resolution)
 *      - Agents.txt (optional, for agent name display)
 *      - Offices.txt (optional, for office name display)
 */

import { syncFromFiles, upsertListings, MLS_DATA_DIR } from '../lib/mls/sync'
import { existsSync } from 'fs'
import { join } from 'path'

// ============================================================
// CLI ARGUMENT PARSING
// ============================================================

const args = process.argv.slice(2)

const options = {
  dryRun: args.includes('--dry-run') || args.includes('-n'),
  preview: getArgValue('--preview'),
  towns: getArgValue('--towns'),
  propTypes: getArgValue('--types'),
  activeOnly: !args.includes('--all-statuses'),
  agentId: getArgValue('--agent-id'),
}

function getArgValue(flag: string): string | null {
  const idx = args.indexOf(flag)
  if (idx === -1 || idx + 1 >= args.length) return null
  return args[idx + 1]
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('═══════════════════════════════════════════════')
  console.log('  MLS PIN → HomeMatch Import')
  console.log('═══════════════════════════════════════════════')
  console.log()

  // Check data directory exists
  if (!existsSync(MLS_DATA_DIR)) {
    console.error(`❌ Data directory not found: ${MLS_DATA_DIR}`)
    console.error()
    console.error('Please create it and add MLS PIN IDX files:')
    console.error('  mkdir -p data/mls')
    console.error('  # Then download files from mlspin.com → IDX Downloads')
    console.error('  # Required: PALL.txt, SF.txt, Towns.txt')
    process.exit(1)
  }

  // Check at least one data file exists
  const availableFiles = ['idx_sf.txt', 'idx_cc.txt', 'idx_ld.txt'].filter(
    f => existsSync(join(MLS_DATA_DIR, f))
  )
  if (availableFiles.length === 0) {
    console.error(`❌ No MLS data files found in ${MLS_DATA_DIR}`)
    console.error('   Expected: idx_sf.txt, idx_cc.txt, or idx_ld.txt')
    console.error('   Download from mlspin.com → IDX Downloads')
    process.exit(1)
  }
  console.log(`📁 Found data files: ${availableFiles.join(', ')}`)

  // Parse filter options
  const filterTowns = options.towns?.split(',').map(t => t.trim()) || undefined
  const filterPropTypes = (options.propTypes?.split(',').map(t => t.trim().toLowerCase()) || ['sf']) as ('sf' | 'cc' | 'ld')[]

  console.log('📋 Configuration:')
  console.log(`   Data dir:       ${MLS_DATA_DIR}`)
  console.log(`   Property types: ${filterPropTypes.join(', ')}`)
  console.log(`   Towns filter:   ${filterTowns?.join(', ') || 'ALL'}`)
  console.log(`   Active only:    ${options.activeOnly}`)
  console.log(`   Dry run:        ${options.dryRun}`)
  console.log()

  // Run sync
  const { listings, result } = syncFromFiles({
    filterTowns,
    filterPropTypes,
    activeOnly: options.activeOnly,
  })

  // Print results
  console.log()
  console.log('═══════════════════════════════════════════════')
  console.log('  SYNC RESULTS')
  console.log('═══════════════════════════════════════════════')
  console.log(`  Total processed: ${result.total}`)
  console.log(`  Mapped:          ${listings.length}`)
  console.log(`  Skipped:         ${result.skipped}`)
  console.log(`  Errors:          ${result.errors.length}`)
  console.log()

  if (result.errors.length > 0) {
    console.log('⚠️  Errors:')
    result.errors.slice(0, 10).forEach(e => console.log(`   ${e}`))
    if (result.errors.length > 10) {
      console.log(`   ... and ${result.errors.length - 10} more`)
    }
    console.log()
  }

  // Preview mode
  if (options.preview) {
    const previewCount = parseInt(options.preview) || 5
    console.log(`📋 Preview (first ${previewCount} listings):`)
    console.log('─────────────────────────────────────────────')
    
    for (const listing of listings.slice(0, previewCount)) {
      console.log()
      console.log(`  MLS# ${listing.mlsNumber}`)
      console.log(`  📍 ${listing.address}, ${listing.city}, ${listing.state} ${listing.zipCode}`)
      console.log(`  💰 $${listing.listPrice.toLocaleString()}`)
      console.log(`  🏠 ${listing.bedrooms}BR / ${listing.bathroomsFull}BA${listing.bathroomsHalf ? ` + ${listing.bathroomsHalf} half` : ''}`)
      console.log(`  📐 ${listing.interiorSqft?.toLocaleString() || '?'} sqft | Lot: ${listing.lotSqft?.toLocaleString() || '?'} sqft`)
      console.log(`  🏗️  Built: ${listing.yearBuilt || '?'} | Style: ${listing.style || '?'}`)
      console.log(`  📸 ${listing.photoCount} photos`)
      console.log(`  📊 Status: ${listing.status}`)
      if (listing.description) {
        console.log(`  📝 ${listing.description.substring(0, 100)}...`)
      }
      console.log(`  🏢 Listed by: ${listing.listAgentName || listing.listAgentId} @ ${listing.listOfficeName || 'Unknown'}`)
    }
    console.log()
  }

  // Database upsert
  if (!options.dryRun && listings.length > 0) {
    const agentId = options.agentId
    if (!agentId) {
      console.log('⚠️  No --agent-id provided. Skipping database write.')
      console.log('   To write to DB, run with: --agent-id <your-agent-user-id>')
      console.log()
      console.log('   You can find your agent ID by running:')
      console.log('   npx prisma studio  (look in User table)')
      return
    }

    console.log(`💾 Upserting ${listings.length} listings to database...`)
    const dbResult = await upsertListings(listings, agentId)
    
    console.log()
    console.log('═══════════════════════════════════════════════')
    console.log('  DATABASE RESULTS')
    console.log('═══════════════════════════════════════════════')
    console.log(`  Inserted: ${dbResult.inserted}`)
    console.log(`  Updated:  ${dbResult.updated}`)
    console.log(`  Errors:   ${dbResult.errors.length}`)
    
    if (dbResult.errors.length > 0) {
      console.log()
      dbResult.errors.slice(0, 5).forEach(e => console.log(`  ⚠️  ${e}`))
    }
  } else if (options.dryRun) {
    console.log('🏁 Dry run complete. No database changes made.')
    console.log('   Remove --dry-run to write to database.')
  }

  console.log()
  console.log('Done! ✨')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

/**
 * MLS PIN Daily Sync Cron Endpoint
 *
 * Triggered by Vercel Cron (twice daily) to download IDX flat files
 * from MLS PIN and upsert listings into the database.
 *
 * Protected by CRON_SECRET env var.
 *
 * Schedule: 0 11,23 * * * (6am/6pm EST)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseMlsFile } from '@/lib/mls/parser'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import {
  MappedListing,
  STATUS_MAP,
  PROP_TYPE_MAP,
  buildPhotoUrls,
  buildAddress,
} from '@/lib/mls/field-map'
import { resolveTownName } from '@/lib/mls/town-map'
import { decodeCp1252 } from '@/lib/mls/decode'
import { autoDeriveVector } from '@/lib/mls/auto-derive-vector'
import { getSchoolRatingNumber } from '@/lib/geo/school-ratings'

// Vercel Pro serverless timeout is 300s. We filter early to stay within limits.
export const maxDuration = 300

// --------------------------------------------------------------------------
// Greater Boston towns filter (approx 67 key towns)
// --------------------------------------------------------------------------

const GREATER_BOSTON_TOWNS = new Set([
  'boston', 'cambridge', 'somerville', 'brookline', 'newton', 'watertown',
  'arlington', 'lexington', 'belmont', 'waltham', 'medford', 'malden',
  'melrose', 'winchester', 'woburn', 'burlington', 'bedford', 'concord',
  'lincoln', 'sudbury', 'wellesley', 'needham', 'dedham', 'milton',
  'quincy', 'braintree', 'weymouth', 'hingham', 'cohasset', 'natick',
  'framingham', 'ashland', 'hopkinton', 'southborough', 'westborough',
  'marlborough', 'hudson', 'stow', 'maynard', 'acton', 'carlisle',
  'chelmsford', 'lowell', 'andover', 'north andover', 'reading',
  'wakefield', 'stoneham', 'saugus', 'lynn', 'marblehead', 'swampscott',
  'salem', 'peabody', 'danvers', 'beverly', 'norwood', 'canton',
  'sharon', 'foxborough', 'walpole', 'dover', 'sherborn', 'medfield',
  'millis', 'holliston', 'medway', 'franklin',
])

// --------------------------------------------------------------------------
// MLS PIN IDX download configuration
// --------------------------------------------------------------------------

const MLS_PIN_BASE_URL = 'https://www.mlspin.com/idx'
// Credentials are loaded from the environment only. There are NO hardcoded
// fallbacks — the route fails closed (see GET handler) if either is missing.
const MLS_PIN_USERNAME = process.env.MLS_PIN_USERNAME
const MLS_PIN_PASSWORD = process.env.MLS_PIN_PASSWORD

const IDX_FILES = [
  { name: 'idx_sf.txt', propType: 'sf' as const },
  { name: 'idx_cc.txt', propType: 'cc' as const },
]

// --------------------------------------------------------------------------
// ROUTE HANDLER
// --------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Rate limit by IP — cheap defense against repeated probing of this endpoint.
  const limit = rateLimit(`cron:sync-mls:${getClientIp(request)}`, {
    limit: 5,
    windowMs: 60_000,
  })
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured' },
      { status: 500 }
    )
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Fail closed: never run the sync without real MLS PIN credentials.
  if (!MLS_PIN_USERNAME || !MLS_PIN_PASSWORD) {
    console.error(
      '[sync-mls] MLS_PIN_USERNAME / MLS_PIN_PASSWORD are not configured — refusing to sync.'
    )
    return NextResponse.json(
      { error: 'MLS PIN credentials not configured' },
      { status: 500 }
    )
  }

  const startTime = Date.now()

  try {
    const summary = {
      synced: 0,
      new: 0,
      updated: 0,
      withdrawn: 0,
      errors: [] as string[],
      filesProcessed: [] as string[],
      durationMs: 0,
      staleNote: undefined as string | undefined,
    }

    // Track which MLS numbers we saw in today's import (for stale detection)
    const seenMlsNumbers = new Set<number>()

    // Download and process each IDX file
    for (const file of IDX_FILES) {
      try {
        const content = await downloadIdxFile(file.name, MLS_PIN_USERNAME, MLS_PIN_PASSWORD)
        if (!content) {
          summary.errors.push(`Failed to download ${file.name}`)
          continue
        }

        summary.filesProcessed.push(file.name)

        // Parse the file
        const records = parseMlsFile<Record<string, string | null>>(content)

        // Process records — filter to Greater Boston early to stay within timeout
        for (const record of records) {
          try {
            const mapped = mapRecordFromRaw(record, file.propType)
            if (!mapped) continue

            // Filter: only Greater Boston towns
            if (!GREATER_BOSTON_TOWNS.has(mapped.city.toLowerCase())) {
              continue
            }

            // Filter: only active/pending listings worth tracking
            if (mapped.status === 'WITHDRAWN' || mapped.status === 'SOLD') {
              continue
            }

            seenMlsNumbers.add(mapped.mlsNumber)

            // Upsert into database
            const result = await upsertListing(mapped)
            summary.synced++
            if (result === 'created') summary.new++
            if (result === 'updated') summary.updated++
          } catch (err) {
            summary.errors.push(
              `MLS#${record.LIST_NO}: ${err instanceof Error ? err.message : String(err)}`
            )
          }

          // Safety: abort if approaching timeout (250s buffer)
          if (Date.now() - startTime > 250_000) {
            summary.errors.push('Approaching timeout — stopped processing early')
            break
          }
        }
      } catch (err) {
        summary.errors.push(
          `File ${file.name}: ${err instanceof Error ? err.message : String(err)}`
        )
      }

      // Check timeout between files too
      if (Date.now() - startTime > 250_000) break
    }

    // Mark stale listings as WITHDRAWN — but ONLY when this run pulled a
    // believable number of records. A failed or partial MLS download would
    // otherwise withdraw most of the live inventory (everything not in the
    // tiny/empty set). The floor + the ?withdraw=0 test flag make this safe to
    // run on demand and resilient to a flaky download leg.
    const withdrawDisabled = request.nextUrl.searchParams.get('withdraw') === '0'
    const STALE_WITHDRAW_FLOOR = 50
    if (withdrawDisabled) {
      summary.staleNote = 'Stale-withdraw skipped (withdraw=0 test mode).'
    } else if (seenMlsNumbers.size < STALE_WITHDRAW_FLOOR) {
      summary.staleNote = `Stale-withdraw skipped: only ${seenMlsNumbers.size} listings synced (floor ${STALE_WITHDRAW_FLOOR}) — likely a partial/failed download, not withdrawing inventory.`
    } else {
      summary.withdrawn = await markStaleListingsWithdrawn(seenMlsNumbers)
    }

    summary.durationMs = Date.now() - startTime

    // Honest diagnosis when the download leg produced nothing. MLS PIN IDX is
    // a manual portal download (Quick Links → IDX Downloads), not a documented
    // programmatic endpoint — the auto-download here is best-effort and may not
    // work against the live service. Surface that instead of a cryptic count.
    const downloadFailed = summary.filesProcessed.length === 0
    return NextResponse.json({
      success: !downloadFailed,
      summary,
      hint: downloadFailed
        ? "No files downloaded. MLS PIN IDX has no documented auto-download endpoint — use the manual refresh flow: download the IDX files from mlspin.com (Quick Links → IDX Downloads) into data/mls/, then run `npx tsx scripts/import-mls.ts --agent-id <id>`. See data/mls/README.md."
        : undefined,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}

// --------------------------------------------------------------------------
// MLS PIN FILE DOWNLOAD
// --------------------------------------------------------------------------

/**
 * Download an IDX file from MLS PIN.
 *
 * MLS PIN requires a session-based login flow:
 * 1. POST to login page to get session cookie
 * 2. Use session cookie to download IDX file
 *
 * Known URL patterns for MLS PIN IDX downloads:
 * - https://www.mlspin.com/idx/<filename>
 * - https://www.mlspin.com/cgi-bin/idx.asp?file=<filename>
 */
async function downloadIdxFile(
  fileName: string,
  username: string,
  password: string
): Promise<string | null> {
  // Step 1: Authenticate and get session cookie
  const sessionCookie = await getMlsPinSession(username, password)
  if (!sessionCookie) {
    return null
  }

  // Step 2: Try known download URL patterns with session
  const downloadUrls = [
    `https://www.mlspin.com/idx/${fileName}`,
    `https://www.mlspin.com/cgi-bin/idx.asp?file=${fileName}`,
    `https://www.mlspin.com/idx/download.aspx?file=${fileName}`,
    `https://idx.mlspin.com/${fileName}`,
  ]

  for (const url of downloadUrls) {
    try {
      const response = await fetch(url, {
        headers: {
          'Cookie': sessionCookie,
          'User-Agent': 'Mozilla/5.0 (compatible; HomeMatch/1.0)',
        },
        redirect: 'follow',
      })

      if (response.ok) {
        const text = decodeCp1252(Buffer.from(await response.arrayBuffer()))
        if (text.includes('|') && !text.toLowerCase().includes('<html')) {
          return text
        }
      }
    } catch {
      continue
    }
  }

  // Step 3: Try HTTP Basic Auth as fallback (some IDX feeds support this)
  const credentials = Buffer.from(`${username}:${password}`).toString('base64')
  for (const url of downloadUrls) {
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'User-Agent': 'Mozilla/5.0 (compatible; HomeMatch/1.0)',
        },
      })

      if (response.ok) {
        const text = decodeCp1252(Buffer.from(await response.arrayBuffer()))
        if (text.includes('|') && !text.toLowerCase().includes('<html')) {
          return text
        }
      }
    } catch {
      continue
    }
  }

  return null
}

/**
 * Login to mlspin.com and return session cookie string.
 */
async function getMlsPinSession(username: string, password: string): Promise<string | null> {
  const loginUrls = [
    'https://www.mlspin.com/login.asp',
    'https://www.mlspin.com/cgi-bin/login.asp',
    'https://www.mlspin.com/idx/login.asp',
  ]

  for (const loginUrl of loginUrls) {
    try {
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (compatible; HomeMatch/1.0)',
        },
        body: `user_name=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
        redirect: 'manual',
      })

      const cookies = response.headers.getSetCookie?.() || []
      if (cookies.length > 0) {
        return cookies.map(c => c.split(';')[0]).join('; ')
      }

      // Some servers return cookies even on 302 redirect
      const setCookie = response.headers.get('set-cookie')
      if (setCookie) {
        return setCookie.split(';')[0]
      }
    } catch {
      continue
    }
  }

  return null
}

// --------------------------------------------------------------------------
// RECORD MAPPING (inline version for serverless — no filesystem dependency)
// --------------------------------------------------------------------------

function mapRecordFromRaw(
  rec: Record<string, string | null>,
  propType: 'sf' | 'cc'
): MappedListing | null {
  const listNo = parseNum(rec.LIST_NO)
  if (!listNo) return null

  const rawStatus = stripQuotes(rec.STATUS)
  const status = STATUS_MAP[rawStatus] || 'WITHDRAWN'

  const streetNo = stripQuotes(rec.STREET_NO)
  const streetName = stripQuotes(rec.STREET_NAME)
  const unitNo = stripQuotes(rec.UNIT_NO)
  const photoCount = parseNum(rec.PHOTO_COUNT) || 0

  // City: the IDX flat files carry a numeric TOWN_NUM (not a TOWN name). Resolve
  // it via the committed town-map (towns.txt is gitignored / absent on serverless).
  // Fall back to NEIGHBORHOOD only when the code is unknown.
  const city = resolveTownName(rec.TOWN_NUM) || stripQuotes(rec.NEIGHBORHOOD) || ''

  return {
    mlsNumber: listNo,
    address: buildAddress(streetNo, streetName, unitNo || null),
    city,
    state: stripQuotes(rec.STATE) || 'MA',
    zipCode: stripQuotes(rec.ZIP_CODE) || '',
    listPrice: parseNum(rec.LIST_PRICE) || 0,
    salePrice: parseNum(rec.SALE_PRICE) || null,
    propertyType: PROP_TYPE_MAP[stripQuotes(rec.PROP_TYPE)] || (propType === 'cc' ? 'CONDO' : 'SFH'),
    bedrooms: parseNum(rec.NO_BEDROOMS) || parseNum(rec.TOTAL_BRS) || 0,
    bathroomsFull: parseNum(rec.NO_FULL_BATHS) || parseNum(rec.TOTAL_FULL_BATHS) || 0,
    bathroomsHalf: parseNum(rec.NO_HALF_BATHS) || parseNum(rec.TOTAL_HALF_BATHS) || 0,
    interiorSqft: parseNum(rec.SQUARE_FEET) || null,
    lotSqft: parseNum(rec.LOT_SIZE) || null,
    yearBuilt: parseNum(rec.YEAR_BUILT) || null,
    hoaFeeMonthly: parseNum(rec.HOA_FEE) || null,
    propertyTaxAnnual: parseNum(rec.TAXES) || null,
    status,
    description: stripQuotes(rec.REMARKS),
    photoCount,
    photos: buildPhotoUrls(listNo, photoCount),
    style: stripQuotes(rec.STYLE) || null,
    heating: stripQuotes(rec.HEATING) || null,
    cooling: stripQuotes(rec.COOLING) || null,
    garageSpaces: parseNum(rec.GARAGE_SPACES) || null,
    basement: stripQuotes(rec.BASEMENT) || null,
    construction: stripQuotes(rec.CONSTRUCTION) || null,
    flooring: stripQuotes(rec.FLOORING) || null,
    lotDescription: stripQuotes(rec.LOT_DESCRIPTION) || null,
    interiorFeatures: stripQuotes(rec.INTERIOR_FEATURES) || null,
    exteriorFeatures: stripQuotes(rec.EXTERIOR_FEATURES) || null,
    appliances: stripQuotes(rec.APPLIANCES) || null,
    listAgentId: stripQuotes(rec.LIST_AGENT) || '',
    listAgentName: null,
    listOfficeName: null,
    neighborhood: stripQuotes(rec.NEIGHBORHOOD) || null,
    county: stripQuotes(rec.COUNTY) || null,
    area: stripQuotes(rec.AREA) || null,
    waterfront: stripQuotes(rec.WATERFRONT_FLAG) || null,
  }
}

// --------------------------------------------------------------------------
// DATABASE OPERATIONS
// --------------------------------------------------------------------------

/**
 * Upsert a single listing. Uses address+zipCode as dedup key (matching sync.ts).
 * Returns 'created' or 'updated'.
 */
async function upsertListing(listing: MappedListing): Promise<'created' | 'updated'> {
  // We need a system agent user for cron-imported listings.
  // Look for existing system user or use the first agent.
  const systemAgent = await getSystemAgentId()

  const existing = await prisma.listing.findFirst({
    where: {
      address: listing.address,
      zipCode: listing.zipCode,
    },
  })

  // Auto-derive scoring dimensions from MLS data + school rating from city,
  // mirroring lib/mls/sync.ts upsertListings so cron-synced inventory scores
  // on real derived data instead of flat null defaults.
  const derived = autoDeriveVector(listing)
  const schoolRating = getSchoolRatingNumber(listing.city)

  const data = {
    agentId: systemAgent,
    address: listing.address,
    city: listing.city,
    state: listing.state,
    zipCode: listing.zipCode,
    listPrice: listing.listPrice,
    propertyType: listing.propertyType as any,
    bedrooms: listing.bedrooms,
    bathroomsFull: listing.bathroomsFull,
    bathroomsHalf: listing.bathroomsHalf,
    interiorSqft: listing.interiorSqft,
    lotSqft: listing.lotSqft,
    yearBuilt: listing.yearBuilt,
    hoaFeeMonthly: listing.hoaFeeMonthly,
    propertyTaxAnnual: listing.propertyTaxAnnual,
    status: listing.status as any,
    photos: listing.photos.slice(0, 10),
    agentNotes: listing.description,
    vector: {
      mlsNumber: listing.mlsNumber,
      price: listing.listPrice,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathroomsFull + listing.bathroomsHalf * 0.5,
      interior_sqft: listing.interiorSqft,
      lot_sqft: listing.lotSqft,
      year_built: listing.yearBuilt,
      style: listing.style,
      heating_type: listing.heating,
      // Auto-derived dimensions (overridden by agent if scored later)
      natural_light: derived.natural_light,
      noise_level: derived.noise_level,
      openness: derived.openness,
      privacy_from_neighbors: derived.privacy,
      move_in_readiness: derived.move_in_readiness,
      yard_usability: derived.yard_usability,
      kitchen_quality: derived.kitchen_quality,
      school_rating: schoolRating,
      _mls: {
        mlsNumber: listing.mlsNumber,
        listAgentId: listing.listAgentId,
        listAgentName: listing.listAgentName,
        listOfficeName: listing.listOfficeName,
        neighborhood: listing.neighborhood,
        county: listing.county,
        style: listing.style,
        heating: listing.heating,
        cooling: listing.cooling,
        garageSpaces: listing.garageSpaces,
        basement: listing.basement,
        construction: listing.construction,
        flooring: listing.flooring,
        interiorFeatures: listing.interiorFeatures,
        exteriorFeatures: listing.exteriorFeatures,
        appliances: listing.appliances,
        waterfront: listing.waterfront,
      },
    },
  }

  if (existing) {
    await prisma.listing.update({
      where: { id: existing.id },
      data,
    })
    return 'updated'
  } else {
    await prisma.listing.create({ data })
    return 'created'
  }
}

/** Cache for system agent ID to avoid repeated queries */
let _systemAgentId: string | null = null

async function getSystemAgentId(): Promise<string> {
  if (_systemAgentId) return _systemAgentId

  // Look for a user with role AGENT (or any user as fallback)
  const agent = await prisma.user.findFirst({
    where: { role: 'AGENT' },
    select: { id: true },
  })

  if (agent) {
    _systemAgentId = agent.id
    return agent.id
  }

  // Fallback: first user
  const firstUser = await prisma.user.findFirst({
    select: { id: true },
  })

  if (!firstUser) {
    throw new Error('No users found in database — cannot assign listing ownership')
  }

  _systemAgentId = firstUser.id
  return firstUser.id
}

/**
 * Mark stale listings as WITHDRAWN.
 * Any ACTIVE listing whose MLS number was NOT in today's import
 * is assumed to be no longer on the market.
 */
async function markStaleListingsWithdrawn(seenMlsNumbers: Set<number>): Promise<number> {
  // Get all ACTIVE listings that have an MLS number in their vector JSON
  const activeListings = await prisma.listing.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, vector: true },
  })

  const idsToWithdraw: string[] = []

  for (const listing of activeListings) {
    const vector = listing.vector as any
    const mlsNumber = vector?.mlsNumber
    if (mlsNumber && !seenMlsNumbers.has(mlsNumber)) {
      idsToWithdraw.push(listing.id)
    }
  }

  if (idsToWithdraw.length > 0) {
    await prisma.listing.updateMany({
      where: { id: { in: idsToWithdraw } },
      data: { status: 'WITHDRAWN' },
    })
  }

  return idsToWithdraw.length
}

// --------------------------------------------------------------------------
// HELPERS
// --------------------------------------------------------------------------

function stripQuotes(val: string | null | undefined): string {
  if (!val) return ''
  return val.replace(/^"|"$/g, '').trim()
}

function parseNum(val: string | null | undefined): number | null {
  if (!val) return null
  const cleaned = val.replace(/^"|"$/g, '').replace(/,/g, '').trim()
  if (cleaned === '' || cleaned === '0') return cleaned === '0' ? 0 : null
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

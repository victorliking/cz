/**
 * MLS PIN Sync Engine (Updated for actual file format)
 * 
 * MLS PIN provides ONE combined file per property type that includes
 * both PALL (common) fields and property-specific fields in a single row.
 * 
 * Files:
 *   - idx_sf.txt → Single Family (PALL + SF fields combined)
 *   - idx_cc.txt → Condo/Co-op (PALL + CC fields combined)
 *   - idx_ld.txt → Land (PALL + LD fields combined)
 * 
 * Format: pipe-delimited, double-quote text qualifier, header row
 * 
 * Flow:
 * 1. Read idx_sf.txt / idx_cc.txt from data/mls/
 * 2. Parse pipe-delimited rows
 * 3. Map to our MappedListing format
 * 4. Upsert into Prisma Listing table
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { parseMlsFile } from './parser'
import { 
  MappedListing, 
  STATUS_MAP, PROP_TYPE_MAP, 
  buildPhotoUrls, buildAddress 
} from './field-map'

// ============================================================
// CONFIGURATION
// ============================================================

/** Directory where MLS data files are stored */
export const MLS_DATA_DIR = join(process.cwd(), 'data', 'mls')

/** File names (as downloaded from MLS PIN) */
export const MLS_FILES = {
  sf: 'idx_sf.txt',            // Single Family (combined PALL + SF)
  cc: 'idx_cc.txt',            // Condo/Co-op (combined PALL + CC)
  ld: 'idx_ld.txt',            // Land (combined PALL + LD)
  mf: 'idx_mf.txt',            // Multi-Family
  towns: 'towns.txt',          // Town reference table
  fieldRef: 'field_reference.txt', // Field code → label lookup
  areas: 'areas.txt',          // Area codes
}

// ============================================================
// MAIN SYNC FUNCTION
// ============================================================

export interface SyncResult {
  total: number
  inserted: number
  updated: number
  withdrawn: number
  errors: string[]
  skipped: number
}

export interface SyncOptions {
  /** Only process listings in these towns/cities (case-insensitive, matches TOWN_NUM or parsed city) */
  filterTowns?: string[]
  /** Only process these property types: 'sf', 'cc', 'ld', 'mf' */
  filterPropTypes?: ('sf' | 'cc' | 'ld' | 'mf')[]
  /** Only process active listings */
  activeOnly?: boolean
  /** Directory override for data files */
  dataDir?: string
  /** Dry run - don't write to DB */
  dryRun?: boolean
  /** Max listings to process (for testing) */
  limit?: number
}

/**
 * Run a full sync from MLS flat files → mapped listings.
 * Returns mapped listings ready for database upsert.
 */
export function syncFromFiles(options: SyncOptions = {}): { 
  listings: MappedListing[] 
  result: SyncResult 
} {
  const dataDir = options.dataDir || MLS_DATA_DIR
  const propTypes = options.filterPropTypes || ['sf', 'cc', 'mf']
  
  const result: SyncResult = {
    total: 0,
    inserted: 0,
    updated: 0,
    withdrawn: 0,
    errors: [],
    skipped: 0,
  }

  // Load reference tables
  const townMap = loadTownMap(dataDir)
  const styleMap = loadStyleMap(dataDir)
  
  const allListings: MappedListing[] = []

  // Process each property type file
  for (const propType of propTypes) {
    const fileName = MLS_FILES[propType]
    const filePath = join(dataDir, fileName)
    
    if (!existsSync(filePath)) {
      console.warn(`⚠️  File not found: ${filePath} — skipping ${propType.toUpperCase()}`)
      continue
    }

    console.log(`📂 Processing ${fileName}...`)
    const content = readFileSync(filePath, 'utf-8')
    const records = parseMlsFile<Record<string, string | null>>(content)
    
    console.log(`   Parsed ${records.length} records from ${fileName}`)

    for (const record of records) {
      result.total++

      // Apply limit
      if (options.limit && allListings.length >= options.limit) {
        result.skipped++
        continue
      }

      // Filter by status
      const rawStatus = stripQuotes(record.STATUS)
      const status = STATUS_MAP[rawStatus] || 'WITHDRAWN'
      if (options.activeOnly && status !== 'ACTIVE') {
        result.skipped++
        continue
      }

      // Map to our format
      try {
        const mapped = mapRecord(record, propType, status, townMap, styleMap)
        
        // Filter by town/city
        if (options.filterTowns && options.filterTowns.length > 0) {
          const cityMatch = options.filterTowns.some(
            t => mapped.city.toLowerCase().includes(t.toLowerCase())
          )
          if (!cityMatch) {
            result.skipped++
            continue
          }
        }

        allListings.push(mapped)
      } catch (err) {
        result.errors.push(`Error mapping LIST_NO ${record.LIST_NO}: ${err}`)
      }
    }
  }

  console.log(`✅ Mapped ${allListings.length} listings total (${result.skipped} skipped, ${result.errors.length} errors)`)

  return { listings: allListings, result }
}

// ============================================================
// RECORD MAPPING
// ============================================================

function mapRecord(
  rec: Record<string, string | null>,
  propType: string,
  status: MappedListing['status'],
  townMap: Map<number, string>,
  styleMap: Map<string, string>
): MappedListing {
  const listNo = parseNum(rec.LIST_NO) || 0
  const streetNo = stripQuotes(rec.STREET_NO)
  const streetName = stripQuotes(rec.STREET_NAME)
  const unitNo = stripQuotes(rec.UNIT_NO)
  const photoCount = parseNum(rec.PHOTO_COUNT) || 0

  const county = stripQuotes(rec.COUNTY)
  const area = stripQuotes(rec.AREA)
  const neighborhood = stripQuotes(rec.NEIGHBORHOOD)
  
  // Resolve town name from TOWN_NUM using towns.txt reference
  const townNum = parseNum(rec.TOWN_NUM) || 0
  const city = townMap.get(townNum) || neighborhood || `Town#${townNum}`
  
  // Resolve style code to readable name
  const rawStyle = stripQuotes(rec.STYLE)
  const style = decodeStyleCode(rawStyle, propType, styleMap)

  return {
    mlsNumber: listNo,
    address: buildAddress(streetNo, streetName, unitNo || null),
    city,
    state: stripQuotes(rec.STATE) || 'MA',
    zipCode: stripQuotes(rec.ZIP_CODE) || '',
    listPrice: parseNum(rec.LIST_PRICE) || 0,
    salePrice: parseNum(rec.SALE_PRICE) || null,
    propertyType: PROP_TYPE_MAP[stripQuotes(rec.PROP_TYPE)] || 'SFH',
    // MF uses TOTAL_BRS/TOTAL_FULL_BATHS; SF/CC use NO_BEDROOMS/NO_FULL_BATHS
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
    // Extra details
    style,
    heating: stripQuotes(rec.HEATING),
    cooling: stripQuotes(rec.COOLING),
    garageSpaces: parseNum(rec.GARAGE_SPACES) || null,
    basement: stripQuotes(rec.BASEMENT) || null,
    construction: stripQuotes(rec.CONSTRUCTION),
    flooring: stripQuotes(rec.FLOORING),
    lotDescription: stripQuotes(rec.LOT_DESCRIPTION),
    interiorFeatures: stripQuotes(rec.INTERIOR_FEATURES),
    exteriorFeatures: stripQuotes(rec.EXTERIOR_FEATURES),
    appliances: stripQuotes(rec.APPLIANCES),
    // Attribution
    listAgentId: stripQuotes(rec.LIST_AGENT) || '',
    listAgentName: null, // Resolved later with Agents table
    listOfficeName: null, // Resolved later with Offices table
    // Meta
    neighborhood: neighborhood || null,
    county: county || null,
    area: area || null,
    waterfront: stripQuotes(rec.WATERFRONT_FLAG),
  }
}

// ============================================================
// TOWN RESOLUTION (using reference file if available)
// ============================================================

/**
 * Load Towns reference table and resolve TOWN_NUM → city name.
 * If Towns file isn't available, listings keep "Town#123" as city.
 */
export function resolveTownNames(
  listings: MappedListing[],
  townsFilePath?: string
): MappedListing[] {
  const filePath = townsFilePath || join(MLS_DATA_DIR, 'Towns.txt')
  
  if (!existsSync(filePath)) {
    console.warn('⚠️  Towns.txt not found — city names will show as Town#XXX')
    console.warn('   Download from mlspin.com → Reference Tables → Towns')
    return listings
  }

  const content = readFileSync(filePath, 'utf-8')
  const townRecords = parseMlsFile<Record<string, string | null>>(content)
  
  // Build lookup map
  const townMap = new Map<number, string>()
  for (const rec of townRecords) {
    const num = parseNum(rec.Town_Num || rec.TOWN_NUM)
    const name = stripQuotes(rec.Long || rec.LONG)
    if (num && name) {
      townMap.set(num, name)
    }
  }

  console.log(`📖 Loaded ${townMap.size} town names`)

  // Resolve
  return listings.map(listing => {
    if (listing.city.startsWith('Town#')) {
      const num = parseInt(listing.city.replace('Town#', ''))
      const resolved = townMap.get(num)
      if (resolved) {
        return { ...listing, city: resolved }
      }
    }
    return listing
  })
}

// ============================================================
// REFERENCE TABLE LOADERS
// ============================================================

/** Load towns.txt into a Map<TOWN_NUM, cityName> */
function loadTownMap(dataDir: string): Map<number, string> {
  const filePath = join(dataDir, MLS_FILES.towns)
  const map = new Map<number, string>()
  
  if (!existsSync(filePath)) {
    console.warn('⚠️  towns.txt not found — cities will show as Town#XXX')
    return map
  }

  const content = readFileSync(filePath, 'utf-8')
  const records = parseMlsFile<Record<string, string | null>>(content)
  
  for (const rec of records) {
    const num = parseNum(rec.TOWN_NUM)
    const name = rec.LONG || ''
    if (num && name) {
      map.set(num, name)
    }
  }

  console.log(`📖 Loaded ${map.size} town names`)
  return map
}

/** Load field_reference.txt and build style code lookups */
function loadStyleMap(dataDir: string): Map<string, string> {
  const filePath = join(dataDir, MLS_FILES.fieldRef)
  const map = new Map<string, string>()
  
  if (!existsSync(filePath)) {
    console.warn('⚠️  field_reference.txt not found — style codes will be raw')
    return map
  }

  const content = readFileSync(filePath, 'utf-8')
  const records = parseMlsFile<Record<string, string | null>>(content)
  
  for (const rec of records) {
    const field = rec.Field || ''
    const short = rec.Short || ''
    const long = rec.Long || ''
    const sf = rec.sf || '0'
    const cc = rec.cc || '0'
    
    if (field === 'STYLE' && short && long) {
      // Store as "sf:A" → "Colonial", "cc:A" → "Detached"
      if (sf === '1') map.set(`sf:${short}`, long)
      if (cc === '1') map.set(`cc:${short}`, long)
      // Also store without prefix as fallback
      if (!map.has(`any:${short}`)) map.set(`any:${short}`, long)
    }
  }

  console.log(`🎨 Loaded ${map.size} style code mappings`)
  return map
}

/** Decode a style code like "A" to "Colonial" based on property type */
function decodeStyleCode(rawStyle: string, propType: string, styleMap: Map<string, string>): string {
  if (!rawStyle) return ''
  
  // Style can be comma-separated codes like "A,D" or a single code
  const codes = rawStyle.split(',').map(c => c.trim())
  const decoded = codes.map(code => {
    // Try property-type-specific lookup first
    const specific = styleMap.get(`${propType}:${code}`)
    if (specific) return specific
    // Fallback to any
    const any = styleMap.get(`any:${code}`)
    if (any) return any
    return code // Return raw code if not found
  })
  
  return decoded.join(', ')
}

// ============================================================
// HELPERS
// ============================================================

/** Strip surrounding double quotes from a value */
function stripQuotes(val: string | null | undefined): string {
  if (!val) return ''
  return val.replace(/^"|"$/g, '').trim()
}

/** Parse a numeric value, handling quoted strings */
function parseNum(val: string | null | undefined): number | null {
  if (!val) return null
  const cleaned = val.replace(/^"|"$/g, '').replace(/,/g, '').trim()
  if (cleaned === '' || cleaned === '0') return cleaned === '0' ? 0 : null
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

// ============================================================
// DATABASE UPSERT (Prisma)
// ============================================================

/**
 * Upsert a batch of mapped listings into the database.
 * Uses mlsNumber as the unique key for dedup.
 */
export async function upsertListings(
  listings: MappedListing[],
  agentUserId: string
): Promise<SyncResult> {
  const { prisma } = await import('@/lib/prisma')
  
  const result: SyncResult = {
    total: listings.length,
    inserted: 0,
    updated: 0,
    withdrawn: 0,
    errors: [],
    skipped: 0,
  }

  for (const listing of listings) {
    try {
      // Find existing by address + zip (dedup key)
      const existing = await prisma.listing.findFirst({
        where: {
          address: listing.address,
          zipCode: listing.zipCode,
        }
      })

      const data = {
        agentId: agentUserId,
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
          // Agent-scored (null until scored)
          natural_light: null,
          noise_level: null,
          openness: null,
          privacy_from_neighbors: null,
          move_in_readiness: null,
          yard_usability: null,
          // MLS raw metadata
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
          }
        },
      }

      if (existing) {
        await prisma.listing.update({
          where: { id: existing.id },
          data,
        })
        result.updated++
      } else {
        await prisma.listing.create({ data })
        result.inserted++
      }
    } catch (err) {
      result.errors.push(`Failed to upsert MLS#${listing.mlsNumber}: ${err}`)
    }
  }

  return result
}

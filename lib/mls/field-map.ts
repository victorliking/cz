/**
 * MLS PIN IDX Field Mapping
 * 
 * Maps MLS PIN pipe-delimited file columns to our Prisma Listing schema.
 * Based on IDX_MLS_DB_Definitions.pdf (Revised October 27, 2025)
 * 
 * MLS PIN provides two file types we join:
 * - PALL: Common fields (address, price, status, photos, etc.)
 * - SF: Single Family specific (beds, baths, sqft, style, etc.)
 * 
 * Join key: LIST_NO (MLS number)
 */

// --- PALL fields (common to all property types) ---
export interface PallRecord {
  LIST_NO: number              // Primary key - MLS number
  LIST_PRICE: number           // Listing price
  STREET_NO: string            // Street number
  STREET_NAME: string          // Street name
  UNIT_NO: string | null       // Unit number
  TOWN_NUM: number             // Town reference number (join with Towns table)
  STATE: number                // State code
  ZIP_CODE: string             // 5-digit zip
  STATUS: string               // ACT, NEW, PCH, SLD, WDN, EXP, etc.
  PROP_TYPE: string            // SF, CC, MF, etc.
  REMARKS: string              // Agent remarks / description
  PHOTO_COUNT: number          // Number of photos available
  PHOTO_DATE: string | null    // When latest photo was added
  YEAR_BUILT: number | null    // Year built
  TAXES: number | null         // Annual tax amount
  TAX_YEAR: string | null      // Tax year
  LIST_AGENT: string           // Listing agent MLS ID
  LIST_OFFICE: string          // Listing office MLS number
  AREA: string                 // Area code (3 chars)
  COUNTY: string               // County name
  NEIGHBORHOOD: string | null  // Neighborhood name
  ADULT_COMMUNITY: string | null // Y/N
  LENDER_OWNED: string | null  // Y/N
  WATERFRONT_FLAG: string | null
  WATERVIEW_FLAG: string | null
  SALE_PRICE: number | null    // Sold price (if sold)
  SETTLED_DATE: string | null  // Sold date
}

// --- SF fields (Single Family specific) ---
export interface SfRecord {
  LIST_NO: number              // Join key
  NO_BEDROOMS: number          // Number of bedrooms
  NO_FULL_BATHS: number        // Full bathrooms
  NO_HALF_BATHS: number        // Half bathrooms
  NO_BATHS: number             // Total baths
  NO_ROOMS: number             // Total rooms
  SQUARE_FEET: number | null   // Approx gross living area
  LOT_SIZE: number | null      // Lot size in sq ft
  ACRE: number | null          // Lot size in acres
  STYLE: string | null         // Colonial, Cape, Ranch, etc.
  HEATING: string | null       // Gas, electric, etc.
  COOLING: string | null       // Central, window, none, etc.
  GARAGE_SPACES: number | null // Number of garage stalls
  GARAGE_PARKING: string | null // Garage features
  BASEMENT: string | null      // Y/N
  BASEMENT_FEATURE: string | null // Finished, unfinished, etc.
  CONSTRUCTION: string | null  // Frame, brick, etc.
  FLOORING: string | null      // Hardwood, carpet, etc.
  ROOF_MATERIAL: string | null // Asphalt, slate, etc.
  SEWER: string | null         // City, septic, etc.
  WATER: string | null         // City, well, etc.
  PARKING_SPACES: number | null
  PARKING_FEATURE: string | null
  TOTAL_PARKING: string | null
  ROAD_TYPE: string | null
  EXTERIOR_FEATURES: string | null
  INTERIOR_FEATURES: string | null
  APPLIANCES: string | null
  LOT_DESCRIPTION: string | null
  ELECTRIC_FEATURE: string | null
  SF_TYPE: string | null       // Type of single family
  MASTER_BATH: string | null   // Y/N
  WATERFRONT: string | null
  WATERVIEW_FEATURES: string | null
  // Room dimensions (we'll use these for size analysis)
  MBR_DIMEN: string | null     // Master bedroom dimensions
  KIT_DIMEN: string | null     // Kitchen dimensions
  LIV_DIMEN: string | null     // Living room dimensions
  DIN_DIMEN: string | null     // Dining room dimensions
  FAM_DIMEN: string | null     // Family room dimensions
  // Above/Below grade
  AboveGradeFinishedArea: number | null
  BelowGradeFinishedArea: number | null
  // HOA
  HOME_OWN_ASSOCIATION: string | null
  FEE_INTERVAL: string | null
}

// --- CC fields (Condo/Co-op specific) ---
export interface CcRecord {
  LIST_NO: number
  NO_BEDROOMS: number
  NO_FULL_BATHS: number
  NO_HALF_BATHS: number
  NO_BATHS: number
  NO_ROOMS: number
  SQUARE_FEET: number | null
  LOT_SIZE: number | null
  STYLE: string | null
  HEATING: string | null
  COOLING: string | null
  CC_TYPE: string | null
  HOA_FEE: number | null
  FEE_INTERVAL: string | null
  GARAGE_SPACES: number | null
  PARKING_SPACES: number | null
  UNIT_LEVEL: number | null
  NO_LIVING_LEVELS: number | null
  FLOORING: string | null
  INTERIOR_FEATURES: string | null
  APPLIANCES: string | null
  MASTER_BATH: string | null
  MBR_DIMEN: string | null
  KIT_DIMEN: string | null
  LIV_DIMEN: string | null
  DIN_DIMEN: string | null
  FAM_DIMEN: string | null
  AboveGradeFinishedArea: number | null
  BelowGradeFinishedArea: number | null
}

// --- Town reference table ---
export interface TownRecord {
  Town_Num: number
  Long: string              // Town name (e.g., "Arlington")
  County: string            // County abbreviation
  State: string             // State (e.g., "MA")
}

// --- Agent roster ---
export interface AgentRecord {
  ID: string                // Agent MLS ID
  First_Name: string
  Last_Name: string
}

// --- Office roster ---
export interface OfficeRecord {
  ID: string                // Office MLS number
  Name: string              // Office name
}

// ============================================================
// FIELD MAPPING: MLS PIN → Prisma Listing model
// ============================================================

export interface MappedListing {
  mlsNumber: number           // LIST_NO - used for dedup/update
  address: string             // STREET_NO + STREET_NAME + UNIT_NO
  city: string                // Resolved from TOWN_NUM via Towns table
  state: string               // Resolved from STATE
  zipCode: string             // ZIP_CODE
  listPrice: number           // LIST_PRICE
  salePrice: number | null    // SALE_PRICE
  propertyType: 'SFH' | 'CONDO' | 'TOWNHOUSE' | 'MULTIFAMILY' | 'COOP'
  bedrooms: number            // NO_BEDROOMS
  bathroomsFull: number       // NO_FULL_BATHS
  bathroomsHalf: number       // NO_HALF_BATHS
  interiorSqft: number | null // SQUARE_FEET
  lotSqft: number | null      // LOT_SIZE
  yearBuilt: number | null    // YEAR_BUILT
  hoaFeeMonthly: number | null // HOA_FEE or HOME_OWN_ASSOCIATION derived
  propertyTaxAnnual: number | null // TAXES
  status: 'ACTIVE' | 'PENDING' | 'SOLD' | 'WITHDRAWN'
  description: string | null  // REMARKS
  photoCount: number          // PHOTO_COUNT
  photos: string[]            // Generated photo URLs from MLS number + count
  // Extra data for matching/display
  style: string | null        // STYLE
  heating: string | null      // HEATING
  cooling: string | null      // COOLING
  garageSpaces: number | null // GARAGE_SPACES
  basement: string | null     // BASEMENT + BASEMENT_FEATURE
  construction: string | null // CONSTRUCTION
  flooring: string | null     // FLOORING
  lotDescription: string | null
  interiorFeatures: string | null
  exteriorFeatures: string | null
  appliances: string | null
  // Agent/office info for attribution
  listAgentId: string         // LIST_AGENT
  listOfficeName: string | null // Resolved from LIST_OFFICE
  listAgentName: string | null  // Resolved from LIST_AGENT
  // Metadata
  neighborhood: string | null
  county: string | null
  area: string | null
  waterfront: string | null
}

// ============================================================
// STATUS MAPPING
// ============================================================

export const STATUS_MAP: Record<string, MappedListing['status']> = {
  'ACT': 'ACTIVE',
  'NEW': 'ACTIVE',
  'BOM': 'ACTIVE',     // Back on Market
  'PCH': 'PENDING',    // Price Change (still active but treating as active)
  'CTG': 'PENDING',    // Contingent
  'UAG': 'PENDING',    // Under Agreement
  'SLD': 'SOLD',
  'WDN': 'WITHDRAWN',
  'EXP': 'WITHDRAWN',  // Expired
  'CAN': 'WITHDRAWN',  // Cancelled
}

// Make PCH actually ACTIVE
STATUS_MAP['PCH'] = 'ACTIVE'

// ============================================================
// PROPERTY TYPE MAPPING
// ============================================================

export const PROP_TYPE_MAP: Record<string, MappedListing['propertyType']> = {
  'SF': 'SFH',
  'CC': 'CONDO',
  'MF': 'MULTIFAMILY',
  'RN': 'CONDO',       // Rental condos mapped to condo
  'MH': 'SFH',         // Mobile home → SFH for now
}

// ============================================================
// PHOTO URL BUILDER
// ============================================================

/**
 * Generate photo URLs for a listing.
 * MLS PIN photo URL format:
 *   https://media.mlspin.com/photo.aspx?mls={LIST_NO}&n={PHOTO_INDEX}&w={WIDTH}&h={HEIGHT}
 * 
 * Photo index starts at 0 (main photo).
 * Available sizes: 1024x768, 600x450, 512x400
 */
export function buildPhotoUrls(
  mlsNumber: number,
  photoCount: number,
  size: '1024x768' | '600x450' | '512x400' = '1024x768'
): string[] {
  const [w, h] = size.split('x')
  const urls: string[] = []
  
  const maxPhotos = Math.min(photoCount, 42) // MLS PIN max is 42
  for (let i = 0; i < maxPhotos; i++) {
    urls.push(
      `https://media.mlspin.com/photo.aspx?mls=${mlsNumber}&n=${i}&w=${w}&h=${h}`
    )
  }
  
  return urls
}

// ============================================================
// ADDRESS BUILDER
// ============================================================

export function buildAddress(streetNo: string, streetName: string, unitNo: string | null): string {
  const parts = [streetNo, streetName].filter(Boolean)
  const address = parts.join(' ')
  if (unitNo) return `${address}, Unit ${unitNo}`
  return address
}

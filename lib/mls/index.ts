/**
 * MLS PIN Integration Module
 * 
 * Handles importing and syncing listing data from MLS PIN's IDX flat files.
 * 
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────┐
 * │  mlspin.com → IDX Downloads                                  │
 * │    ├── PALL.txt (all listings: address, price, status)       │
 * │    ├── SF.txt (single family: beds, baths, sqft, style)     │
 * │    ├── Towns.txt (town number → name lookup)                 │
 * │    ├── Agents.txt (agent ID → name)                          │
 * │    └── Offices.txt (office ID → name)                        │
 * └─────────────────────────┬───────────────────────────────────┘
 *                           │ Download & place in data/mls/
 *                           ▼
 * ┌─────────────────────────────────────────────────────────────┐
 * │  parser.ts                                                    │
 * │    parseMlsFile() → pipe-delimited parsing                   │
 * │    coerceRecord() → type conversion (string→number, etc.)    │
 * │    parseTownsFile(), parseAgentsFile(), parseOfficesFile()    │
 * └─────────────────────────┬───────────────────────────────────┘
 *                           │ Raw typed records
 *                           ▼
 * ┌─────────────────────────────────────────────────────────────┐
 * │  field-map.ts                                                 │
 * │    Maps MLS columns → our schema (MappedListing)             │
 * │    STATUS_MAP, PROP_TYPE_MAP                                  │
 * │    buildPhotoUrls(), buildAddress()                           │
 * └─────────────────────────┬───────────────────────────────────┘
 *                           │ MappedListing[]
 *                           ▼
 * ┌─────────────────────────────────────────────────────────────┐
 * │  sync.ts                                                      │
 * │    syncFromFiles() → orchestrates full pipeline               │
 * │    upsertListings() → writes to Prisma DB                    │
 * └─────────────────────────┬───────────────────────────────────┘
 *                           │ Listing records in DB
 *                           ▼
 * ┌─────────────────────────────────────────────────────────────┐
 * │  Match Engine (lib/scoring/match-engine.ts)                   │
 * │    Now works with real MLS data instead of mock listings!    │
 * └─────────────────────────────────────────────────────────────┘
 */

export { parseMlsFile, coerceRecord, parseTownsFile, parseAgentsFile, parseOfficesFile } from './parser'
export { 
  buildPhotoUrls, buildAddress, 
  STATUS_MAP, PROP_TYPE_MAP 
} from './field-map'
export type { PallRecord, SfRecord, CcRecord, MappedListing, TownRecord, AgentRecord, OfficeRecord } from './field-map'
export { syncFromFiles, upsertListings, MLS_DATA_DIR, MLS_FILES } from './sync'
export type { SyncResult, SyncOptions } from './sync'

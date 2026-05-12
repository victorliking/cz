/**
 * MLS PIN IDX File Parser
 * 
 * Parses pipe-delimited (|) flat files from MLS PIN's IDX data download.
 * Files use double quotes (") as text qualifier.
 * 
 * Usage:
 *   const records = parseMlsFile<SfRecord>(fileContent, SF_COLUMNS)
 */

/**
 * Parse a pipe-delimited MLS PIN data file into typed records.
 * 
 * File format:
 * - First row is header (column names)
 * - Delimiter: pipe (|)
 * - Text qualifier: double quote (")
 * - Line ending: \r\n or \n
 */
export function parseMlsFile<T extends Record<string, unknown>>(
  content: string,
  columnDefs?: string[] // Optional: override header row with known columns
): T[] {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0)
  
  if (lines.length === 0) return []

  // First line is header
  const headerLine = lines[0]
  const columns = columnDefs || parsePipeLine(headerLine).map(col => col.trim())
  
  const records: T[] = []
  
  for (let i = 1; i < lines.length; i++) {
    const values = parsePipeLine(lines[i])
    
    if (values.length === 0) continue
    
    const record: Record<string, unknown> = {}
    
    for (let j = 0; j < columns.length; j++) {
      const col = columns[j]
      const raw = j < values.length ? values[j] : ''
      record[col] = raw === '' ? null : raw
    }
    
    records.push(record as T)
  }
  
  return records
}

/**
 * Parse a single pipe-delimited line, respecting double-quote text qualifiers.
 * Handles cases like: "value with | pipe"|"normal"|123|"quoted ""escaped"" value"
 */
function parsePipeLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false
  let i = 0
  
  while (i < line.length) {
    const char = line[i]
    
    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote (doubled)
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i += 2
        } else {
          // End of quoted value
          inQuotes = false
          i++
        }
      } else {
        current += char
        i++
      }
    } else {
      if (char === '"') {
        inQuotes = true
        i++
      } else if (char === '|') {
        values.push(current.trim())
        current = ''
        i++
      } else {
        current += char
        i++
      }
    }
  }
  
  // Don't forget the last value
  values.push(current.trim())
  
  return values
}

/**
 * Convert raw string values to proper types based on column definitions.
 * Handles: numbers, dates, booleans (Y/N)
 */
export function coerceValue(value: string | null, expectedType: 'number' | 'string' | 'boolean' | 'date'): unknown {
  if (value === null || value === '') return null
  
  switch (expectedType) {
    case 'number': {
      const num = parseFloat(value.replace(/,/g, ''))
      return isNaN(num) ? null : num
    }
    case 'boolean':
      return value.toUpperCase() === 'Y' || value === '1'
    case 'date':
      return value // Keep as string, convert when needed
    case 'string':
    default:
      return value
  }
}

/**
 * Type coercion map for PALL fields
 */
export const PALL_TYPES: Record<string, 'number' | 'string' | 'boolean' | 'date'> = {
  LIST_NO: 'number',
  LIST_PRICE: 'number',
  STREET_NO: 'string',
  STREET_NAME: 'string',
  UNIT_NO: 'string',
  TOWN_NUM: 'number',
  STATE: 'number',
  ZIP_CODE: 'string',
  STATUS: 'string',
  PROP_TYPE: 'string',
  REMARKS: 'string',
  PHOTO_COUNT: 'number',
  PHOTO_DATE: 'date',
  YEAR_BUILT: 'number',
  TAXES: 'number',
  TAX_YEAR: 'string',
  LIST_AGENT: 'string',
  LIST_OFFICE: 'string',
  AREA: 'string',
  COUNTY: 'string',
  NEIGHBORHOOD: 'string',
  ADULT_COMMUNITY: 'string',
  LENDER_OWNED: 'string',
  WATERFRONT_FLAG: 'string',
  WATERVIEW_FLAG: 'string',
  SALE_PRICE: 'number',
  SETTLED_DATE: 'date',
}

/**
 * Type coercion map for SF fields
 */
export const SF_TYPES: Record<string, 'number' | 'string' | 'boolean' | 'date'> = {
  LIST_NO: 'number',
  NO_BEDROOMS: 'number',
  NO_FULL_BATHS: 'number',
  NO_HALF_BATHS: 'number',
  NO_BATHS: 'number',
  NO_ROOMS: 'number',
  SQUARE_FEET: 'number',
  LOT_SIZE: 'number',
  ACRE: 'number',
  STYLE: 'string',
  HEATING: 'string',
  COOLING: 'string',
  GARAGE_SPACES: 'number',
  GARAGE_PARKING: 'string',
  BASEMENT: 'string',
  BASEMENT_FEATURE: 'string',
  CONSTRUCTION: 'string',
  FLOORING: 'string',
  ROOF_MATERIAL: 'string',
  SEWER: 'string',
  WATER: 'string',
  PARKING_SPACES: 'number',
  PARKING_FEATURE: 'string',
  TOTAL_PARKING: 'string',
  ROAD_TYPE: 'string',
  EXTERIOR_FEATURES: 'string',
  INTERIOR_FEATURES: 'string',
  APPLIANCES: 'string',
  LOT_DESCRIPTION: 'string',
  ELECTRIC_FEATURE: 'string',
  SF_TYPE: 'string',
  MASTER_BATH: 'string',
  WATERFRONT: 'string',
  WATERVIEW_FEATURES: 'string',
  MBR_DIMEN: 'string',
  KIT_DIMEN: 'string',
  LIV_DIMEN: 'string',
  DIN_DIMEN: 'string',
  FAM_DIMEN: 'string',
  AboveGradeFinishedArea: 'number',
  BelowGradeFinishedArea: 'number',
  HOME_OWN_ASSOCIATION: 'string',
  FEE_INTERVAL: 'string',
}

/**
 * Apply type coercion to a parsed record.
 */
export function coerceRecord<T extends Record<string, unknown>>(
  record: Record<string, unknown>,
  typeMap: Record<string, 'number' | 'string' | 'boolean' | 'date'>
): T {
  const coerced: Record<string, unknown> = {}
  
  for (const [key, value] of Object.entries(record)) {
    const expectedType = typeMap[key] || 'string'
    coerced[key] = coerceValue(value as string | null, expectedType)
  }
  
  return coerced as T
}

/**
 * Parse a Towns reference file.
 * Returns a Map of town_num → town name for quick lookup.
 */
export function parseTownsFile(content: string): Map<number, { name: string; county: string; state: string }> {
  const records = parseMlsFile<Record<string, string>>(content)
  const townMap = new Map<number, { name: string; county: string; state: string }>()
  
  for (const rec of records) {
    const num = parseInt(rec.Town_Num || rec.TOWN_NUM || '0')
    if (num > 0) {
      townMap.set(num, {
        name: rec.Long || rec.LONG || '',
        county: rec.County || rec.COUNTY || '',
        state: rec.State || rec.STATE || 'MA',
      })
    }
  }
  
  return townMap
}

/**
 * Parse Agents roster file.
 * Returns a Map of agent ID → full name.
 */
export function parseAgentsFile(content: string): Map<string, string> {
  const records = parseMlsFile<Record<string, string>>(content)
  const agentMap = new Map<string, string>()
  
  for (const rec of records) {
    const id = rec.ID || rec.id || ''
    const firstName = rec.First_Name || rec.FIRST_NAME || ''
    const lastName = rec.Last_Name || rec.LAST_NAME || ''
    if (id) {
      agentMap.set(id, `${firstName} ${lastName}`.trim())
    }
  }
  
  return agentMap
}

/**
 * Parse Offices roster file.
 * Returns a Map of office ID → office name.
 */
export function parseOfficesFile(content: string): Map<string, string> {
  const records = parseMlsFile<Record<string, string>>(content)
  const officeMap = new Map<string, string>()
  
  for (const rec of records) {
    const id = rec.ID || rec.id || ''
    const name = rec.Name || rec.NAME || ''
    if (id) {
      officeMap.set(id, name)
    }
  }
  
  return officeMap
}

# MLS PIN IDX Data Files

This directory stores the raw data files downloaded from MLS PIN (mlspin.com).

## How to Download

1. Log into **mlspin.com** with your agent credentials
2. Go to **Quick Links → IDX Downloads**
3. Download these files:

### Required Files:
| File | Source | Description |
|------|--------|-------------|
| `PALL.txt` | "Internet Data Exchange Active Data Files" → any link | Common fields (address, price, status, photos) |
| `SF.txt` | "Single Family (SF)" under Active Data Files | Single family specific (beds, baths, sqft, style) |
| `Towns.txt` | "Reference Tables" → Towns | Town number → name lookup |

### Optional (but recommended):
| File | Source | Description |
|------|--------|-------------|
| `Agents.txt` | "Agent/Office Rosters" → Agents | Agent ID → name lookup |
| `Offices.txt` | "Agent/Office Rosters" → Offices | Office ID → name lookup |
| `CC.txt` | "Condo (CC)" under Active Data Files | Condo specific data |
| `MF.txt` | "Multi-Family (MF)" under Active Data Files | Multi-family specific data |

### Sold Data (for price analysis):
| File | Source | Description |
|------|--------|-------------|
| `PALL_SOLD.txt` | "Internet Data Exchange Sold Data Files" → any link | Sold listing common fields |
| `SF_SOLD.txt` | "Single Family (SF)" under Sold Data Files | Sold SF details |

## File Format

- **Delimiter:** Pipe (`|`)
- **Text qualifier:** Double quote (`"`)
- **Encoding:** UTF-8
- **First row:** Column headers
- **Join key:** `LIST_NO` (MLS number) links PALL to property-type files

## Running the Import

```bash
# Preview what will be imported (no DB changes)
npx tsx scripts/import-mls.ts --dry-run --preview 10

# Import only Arlington, Belmont, Watertown
npx tsx scripts/import-mls.ts --towns Arlington,Belmont,Watertown --preview 5

# Full import to database
npx tsx scripts/import-mls.ts --agent-id <your-agent-user-id>
```

## Update Frequency

MLS PIN recommends updating data at least every 12 hours for compliance.
For your use case, daily downloads are sufficient during development.

## ⚠️ Important Notes

- **DO NOT** commit these files to git (they contain licensed MLS data)
- Data must be used in compliance with MLS PIN Rules Section 10.3
- Must display "Listing courtesy of [office name]" attribution
- Must respect office opt-out list (IDX_Optout)
- Photo URLs expire — hotlink directly from `media.mlspin.com`

## Photo URLs

Photos are accessed via URL pattern:
```
https://media.mlspin.com/photo.aspx?mls={LIST_NO}&n={PHOTO_INDEX}&w={WIDTH}&h={HEIGHT}
```

Available sizes: 1024x768, 600x450, 512x400  
Photo index: 0 = main photo, 1-41 = additional (max 42 total)

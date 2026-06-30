import { describe, it, expect } from "vitest"
import {
  STATUS_MAP,
  PROP_TYPE_MAP,
  buildAddress,
  buildPhotoUrls,
} from "@/lib/mls/field-map"
import { resolveTownName, TOWN_NUM_TO_NAME } from "@/lib/mls/town-map"

describe("STATUS_MAP", () => {
  it("maps active-family codes to ACTIVE", () => {
    expect(STATUS_MAP["ACT"]).toBe("ACTIVE")
    expect(STATUS_MAP["NEW"]).toBe("ACTIVE")
    expect(STATUS_MAP["BOM"]).toBe("ACTIVE")
  })

  it("maps pending-family codes to PENDING", () => {
    expect(STATUS_MAP["CTG"]).toBe("PENDING")
    expect(STATUS_MAP["UAG"]).toBe("PENDING")
  })

  it("maps SLD to SOLD", () => {
    expect(STATUS_MAP["SLD"]).toBe("SOLD")
  })

  it("maps withdrawn/expired/cancelled codes to WITHDRAWN", () => {
    expect(STATUS_MAP["WDN"]).toBe("WITHDRAWN")
    expect(STATUS_MAP["EXP"]).toBe("WITHDRAWN")
    expect(STATUS_MAP["CAN"]).toBe("WITHDRAWN")
  })

  it("treats PCH as ACTIVE (the late reassignment at the bottom of the module wins over the earlier PENDING entry)", () => {
    // The module first declares PCH -> PENDING, then reassigns STATUS_MAP['PCH'] = 'ACTIVE'.
    // The reassignment is what actually takes effect. This test locks in that real behavior.
    expect(STATUS_MAP["PCH"]).toBe("ACTIVE")
  })

  // ---------------------------------------------------------------------------
  // KNOWN MISMATCH (tracked, not hidden):
  //
  // The real MLS PIN status codes present in the IDX feed (verified by sampling
  // data/mls/idx_sf.txt) include "PCG" (Price Change, 251 rows), "EXT" (Extended,
  // 14 rows), and "RAC" (Reactivated, 4 rows) — all still on the market. Earlier
  // the map only had "PCH"/"EXP", so these genuine codes fell through to the
  // `|| 'WITHDRAWN'` default and ~265 active listings were silently hidden.
  // ---------------------------------------------------------------------------

  it("maps real feed code 'PCG' (Price Change) to ACTIVE", () => {
    expect(STATUS_MAP["PCG"]).toBe("ACTIVE")
  })

  it("maps real feed code 'EXT' (Extended) to ACTIVE", () => {
    expect(STATUS_MAP["EXT"]).toBe("ACTIVE")
  })

  it("maps real feed code 'RAC' (Reactivated) to ACTIVE", () => {
    expect(STATUS_MAP["RAC"]).toBe("ACTIVE")
  })
})

describe("PROP_TYPE_MAP", () => {
  it("maps the known MLS PIN property-type codes", () => {
    expect(PROP_TYPE_MAP["SF"]).toBe("SFH")
    expect(PROP_TYPE_MAP["CC"]).toBe("CONDO")
    expect(PROP_TYPE_MAP["MF"]).toBe("MULTIFAMILY")
    expect(PROP_TYPE_MAP["RN"]).toBe("CONDO")
    expect(PROP_TYPE_MAP["MH"]).toBe("SFH")
  })
})

describe("buildAddress", () => {
  it("joins street number and name", () => {
    expect(buildAddress("42", "Main St", null)).toBe("42 Main St")
  })

  it("appends the unit when present", () => {
    expect(buildAddress("42", "Main St", "3B")).toBe("42 Main St, Unit 3B")
  })

  it("drops empty street-number parts", () => {
    expect(buildAddress("", "Main St", null)).toBe("Main St")
  })
})

describe("buildPhotoUrls", () => {
  it("builds one URL per photo using the requested size", () => {
    const urls = buildPhotoUrls(12345, 3, "600x450")
    expect(urls).toHaveLength(3)
    expect(urls[0]).toBe("https://media.mlspin.com/photo.aspx?mls=12345&n=0&w=600&h=450")
    expect(urls[2]).toContain("&n=2&")
  })

  it("caps the number of photos at the MLS PIN maximum of 42", () => {
    const urls = buildPhotoUrls(12345, 100)
    expect(urls).toHaveLength(42)
  })

  it("returns an empty array when there are no photos", () => {
    expect(buildPhotoUrls(12345, 0)).toEqual([])
  })
})

describe("resolveTownName (TOWN_NUM lookup)", () => {
  // The cron sync reads the numeric TOWN_NUM column (the IDX files have no TOWN
  // name column). This map is committed as code because data/mls/towns.txt is
  // gitignored / absent on the serverless filesystem.
  it("resolves known Greater Boston TOWN_NUM codes to town names", () => {
    expect(resolveTownName(1)).toBe("Boston")
    expect(resolveTownName(13)).toBe("Cambridge")
    expect(resolveTownName(17)).toBe("Somerville")
    expect(resolveTownName(42)).toBe("Arlington")
  })

  it("accepts string TOWN_NUM values (as they arrive from the parsed feed)", () => {
    expect(resolveTownName("13")).toBe("Cambridge")
    expect(resolveTownName('"13"')).toBe("Cambridge") // tolerant of stray quotes
  })

  it("returns empty string for unknown / blank codes (caller falls back to NEIGHBORHOOD)", () => {
    expect(resolveTownName(999999)).toBe("")
    expect(resolveTownName("")).toBe("")
    expect(resolveTownName(null)).toBe("")
    expect(resolveTownName(undefined)).toBe("")
  })

  it("has a substantial town table loaded", () => {
    expect(Object.keys(TOWN_NUM_TO_NAME).length).toBeGreaterThan(2000)
  })
})

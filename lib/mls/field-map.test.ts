import { describe, it, expect } from "vitest"
import {
  STATUS_MAP,
  PROP_TYPE_MAP,
  buildAddress,
  buildPhotoUrls,
} from "@/lib/mls/field-map"

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
  // Per IDX_MLS_DB_Definitions.pdf the real MLS PIN status codes include
  // "PCG" (Price Change) and "EXT" (Extended). The STATUS_MAP here instead
  // uses "PCH" and "EXP", so the genuine feed codes fall through unmapped
  // (lookup returns undefined). The two tests below document CURRENT behavior;
  // the .todo tests below capture the DESIRED behavior so it's tracked.
  // ---------------------------------------------------------------------------

  it("CURRENT behavior: real code 'PCG' is NOT mapped (returns undefined)", () => {
    expect(STATUS_MAP["PCG"]).toBeUndefined()
  })

  it("CURRENT behavior: real code 'EXT' is NOT mapped (returns undefined)", () => {
    expect(STATUS_MAP["EXT"]).toBeUndefined()
  })

  it.todo("DESIRED: 'PCG' (Price Change) should map to ACTIVE — add STATUS_MAP['PCG'] = 'ACTIVE'")

  it.todo("DESIRED: 'EXT' (Extended) should map to a real status (likely ACTIVE) — add STATUS_MAP['EXT']")
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

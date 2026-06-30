import { describe, it, expect } from "vitest"
import {
  calculateAffordability,
  calculatePerCity,
  MA_TAX_RATES,
  type AffordabilityInputs,
} from "@/lib/financial/affordability"

/**
 * These tests cover only the deterministic max-home-price math.
 * fetchCurrentMortgageRate() is intentionally NOT tested here — it does a
 * live network fetch.
 */

const BASE: AffordabilityInputs = {
  monthlyPaymentComfort: 3500,
  downPayment: 150000,
  interestRate: 0.068,
}

describe("calculateAffordability", () => {
  it("produces a max home price in a sane range for a typical buyer", () => {
    const r = calculateAffordability(BASE)
    // $3,500/mo comfort + $150k down at 6.8% lands in the mid-$500k range.
    expect(r.maxHomePrice).toBeGreaterThan(400000)
    expect(r.maxHomePrice).toBeLessThan(750000)
  })

  it("loan amount equals max price minus the down payment", () => {
    const r = calculateAffordability(BASE)
    expect(r.loanAmount).toBe(r.maxHomePrice - BASE.downPayment)
  })

  it("monthly breakdown components are non-negative and reasonable", () => {
    const r = calculateAffordability(BASE)
    expect(r.monthlyBreakdown.principal_interest).toBeGreaterThan(0)
    expect(r.monthlyBreakdown.property_tax).toBeGreaterThan(0)
    expect(r.monthlyBreakdown.insurance).toBe(Math.round(1800 / 12)) // 150
    expect(r.monthlyBreakdown.hoa).toBe(0)
    expect(r.monthlyBreakdown.pmi).toBeGreaterThanOrEqual(0)
  })

  it("comfortable range is below max and stretch range is above max", () => {
    const r = calculateAffordability(BASE)
    expect(r.comfortableRange[0]).toBeLessThan(r.comfortableRange[1])
    expect(r.comfortableRange[1]).toBe(r.maxHomePrice)
    expect(r.stretchRange[0]).toBe(r.maxHomePrice)
    expect(r.stretchRange[1]).toBeGreaterThan(r.maxHomePrice)
    // -10% comfortable floor, +15% stretch ceiling.
    // NOTE: the source derives the range bounds from the UN-rounded maxPrice
    // while maxHomePrice is the rounded value, so exact equality can be off by
    // one dollar. Assert the documented ratios within a 1-dollar tolerance.
    expect(Math.abs(r.comfortableRange[0] - r.maxHomePrice * 0.9)).toBeLessThanOrEqual(1)
    expect(Math.abs(r.stretchRange[1] - r.maxHomePrice * 1.15)).toBeLessThanOrEqual(1)
  })

  it("monotonic in interest rate: higher rate -> lower max price", () => {
    const low = calculateAffordability({ ...BASE, interestRate: 0.05 })
    const mid = calculateAffordability({ ...BASE, interestRate: 0.068 })
    const high = calculateAffordability({ ...BASE, interestRate: 0.09 })
    expect(low.maxHomePrice).toBeGreaterThan(mid.maxHomePrice)
    expect(mid.maxHomePrice).toBeGreaterThan(high.maxHomePrice)
  })

  it("monotonic in monthly payment: higher comfort -> higher max price", () => {
    const lower = calculateAffordability({ ...BASE, monthlyPaymentComfort: 3000 })
    const higher = calculateAffordability({ ...BASE, monthlyPaymentComfort: 5000 })
    expect(higher.maxHomePrice).toBeGreaterThan(lower.maxHomePrice)
  })

  it("monotonic in down payment: more down -> higher affordable home price", () => {
    const less = calculateAffordability({ ...BASE, downPayment: 100000 })
    const more = calculateAffordability({ ...BASE, downPayment: 250000 })
    expect(more.maxHomePrice).toBeGreaterThan(less.maxHomePrice)
  })

  it("a higher-tax city yields a lower max price than a lower-tax city", () => {
    // Cambridge ~5.86/1000 vs Needham ~11.73/1000
    const lowTax = calculateAffordability({ ...BASE, targetCities: ["Cambridge"] })
    const highTax = calculateAffordability({ ...BASE, targetCities: ["Needham"] })
    expect(lowTax.maxHomePrice).toBeGreaterThan(highTax.maxHomePrice)
  })

  it("HOA dues reduce the affordable home price", () => {
    const noHoa = calculateAffordability(BASE)
    const withHoa = calculateAffordability({ ...BASE, monthlyHOA: 500 })
    expect(withHoa.maxHomePrice).toBeLessThan(noHoa.maxHomePrice)
    expect(withHoa.monthlyBreakdown.hoa).toBe(500)
  })

  it("ltv is between 0 and 1", () => {
    const r = calculateAffordability(BASE)
    expect(r.ltv).toBeGreaterThan(0)
    expect(r.ltv).toBeLessThan(1)
  })

  it("applies PMI when LTV exceeds 80% (small down payment)", () => {
    const r = calculateAffordability({ ...BASE, downPayment: 20000 })
    expect(r.ltv).toBeGreaterThan(0.8)
    expect(r.monthlyBreakdown.pmi).toBeGreaterThan(0)
  })
})

describe("calculatePerCity", () => {
  it("returns one entry per requested city with the city's tax rate", () => {
    const rows = calculatePerCity({ ...BASE, targetCities: ["Cambridge", "Needham"] })
    expect(rows.map((r) => r.city)).toEqual(["Cambridge", "Needham"])
    expect(rows[0].taxRate).toBe(MA_TAX_RATES["Cambridge"])
    expect(rows[1].taxRate).toBe(MA_TAX_RATES["Needham"])
  })

  it("ranks the lower-tax city as more affordable (higher max price)", () => {
    const rows = calculatePerCity({ ...BASE, targetCities: ["Cambridge", "Needham"] })
    const cambridge = rows.find((r) => r.city === "Cambridge")!
    const needham = rows.find((r) => r.city === "Needham")!
    expect(cambridge.maxPrice).toBeGreaterThan(needham.maxPrice)
  })

  it("defaults to the first five known MA towns when no cities are given", () => {
    const rows = calculatePerCity(BASE)
    expect(rows).toHaveLength(5)
    expect(rows.map((r) => r.city)).toEqual(Object.keys(MA_TAX_RATES).slice(0, 5))
  })
})

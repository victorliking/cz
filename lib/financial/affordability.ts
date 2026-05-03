/**
 * Affordability Calculator
 * Reverse-calculates max home price from monthly payment comfort.
 * Accounts for: mortgage rate, property tax (MA by town), insurance, PMI, HOA.
 */

// MA property tax rates by municipality (FY2024 residential, per $1000 assessed value)
export const MA_TAX_RATES: Record<string, number> = {
  "Boston": 10.88,        // ~1.09%
  "Cambridge": 5.86,      // ~0.59%
  "Somerville": 10.36,    // ~1.04%
  "Newton": 10.76,        // ~1.08%
  "Brookline": 10.04,     // ~1.00%
  "Wellesley": 11.02,     // ~1.10%
  "Needham": 11.73,       // ~1.17%
  "Dover": 14.27,         // ~1.43%
  "Westwood": 13.17,      // ~1.32%
  "Quincy": 11.98,        // ~1.20%
  "Arlington": 11.45,     // ~1.15%
  "Watertown": 11.13,     // ~1.11%
  "Lexington": 12.42,     // ~1.24%
  "Medford": 10.95,       // ~1.10%
  "Waltham": 10.28,       // ~1.03%
}

/**
 * Fetch current 30-year fixed mortgage rate.
 * Uses Freddie Mac PMMS rate via a fallback approach:
 * 1. Try external API
 * 2. Fall back to a manually-set default
 */
export const CURRENT_RATE_DEFAULT = 0.0685 // 6.85% as of late 2024

export async function fetchCurrentMortgageRate(): Promise<number> {
  try {
    // Try to fetch from a free mortgage rate API
    const res = await fetch(
      "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/avg_interest_rates?sort=-record_date&page[size]=1&filter=security_desc:eq:Treasury%20Notes",
      { next: { revalidate: 86400 } } // cache for 24h
    )
    if (res.ok) {
      const data = await res.json()
      const treasuryRate = parseFloat(data?.data?.[0]?.avg_interest_rate_amt)
      if (!isNaN(treasuryRate)) {
        // Mortgage rate ≈ 10-year Treasury + ~1.7% spread
        return (treasuryRate + 1.7) / 100
      }
    }
  } catch {
    // Silently fall back
  }
  return CURRENT_RATE_DEFAULT
}

// Default rate if city not found
const DEFAULT_TAX_RATE = 11.0 // per $1000

export interface AffordabilityInputs {
  monthlyPaymentComfort: number   // e.g. $3500
  downPayment: number             // e.g. $150000
  interestRate?: number           // annual, e.g. 0.068 for 6.8%
  loanTermYears?: number          // default 30
  annualInsurance?: number        // default $1800
  monthlyHOA?: number             // default $0 for SFH, $300-500 for condos
  targetCities?: string[]         // for per-city calculation
}

export interface AffordabilityResult {
  maxHomePrice: number
  loanAmount: number
  monthlyBreakdown: {
    principal_interest: number
    property_tax: number
    insurance: number
    pmi: number
    hoa: number
  }
  ltv: number // loan-to-value ratio
  comfortableRange: [number, number]  // -10% to 0
  stretchRange: [number, number]      // 0 to +15%
}

export interface CityAffordability {
  city: string
  maxPrice: number
  comfortablePrice: number
  stretchPrice: number
  monthlyTax: number
  taxRate: number
}

/**
 * Calculate max home price from monthly payment
 */
export function calculateAffordability(inputs: AffordabilityInputs): AffordabilityResult {
  const {
    monthlyPaymentComfort,
    downPayment,
    interestRate = 0.068,
    loanTermYears = 30,
    annualInsurance = 1800,
    monthlyHOA = 0,
  } = inputs

  const monthlyInsurance = annualInsurance / 12
  const monthlyRate = interestRate / 12
  const numPayments = loanTermYears * 12

  // Average tax rate across target cities or default
  const avgTaxRate = inputs.targetCities?.length
    ? inputs.targetCities.reduce((sum, city) => {
        return sum + (MA_TAX_RATES[city] || DEFAULT_TAX_RATE)
      }, 0) / inputs.targetCities.length
    : DEFAULT_TAX_RATE

  // Monthly property tax per dollar of home value
  const monthlyTaxPerDollar = (avgTaxRate / 1000) / 12

  // Available for P&I after subtracting fixed costs and estimated tax
  // We solve iteratively since tax depends on home price
  let maxPrice = solveForMaxPrice(
    monthlyPaymentComfort,
    downPayment,
    monthlyRate,
    numPayments,
    monthlyTaxPerDollar,
    monthlyInsurance,
    monthlyHOA
  )

  const loanAmount = maxPrice - downPayment
  const ltv = loanAmount / maxPrice

  // PMI if LTV > 80%
  const monthlyPMI = ltv > 0.8 ? (loanAmount * 0.005) / 12 : 0

  // Recalculate with PMI
  if (monthlyPMI > 0) {
    maxPrice = solveForMaxPrice(
      monthlyPaymentComfort - monthlyPMI,
      downPayment,
      monthlyRate,
      numPayments,
      monthlyTaxPerDollar,
      monthlyInsurance,
      monthlyHOA
    )
  }

  const finalLoan = maxPrice - downPayment
  const pi = calculateMonthlyPI(finalLoan, monthlyRate, numPayments)
  const monthlyTax = maxPrice * monthlyTaxPerDollar
  const finalPMI = (finalLoan / maxPrice) > 0.8 ? (finalLoan * 0.005) / 12 : 0

  return {
    maxHomePrice: Math.round(maxPrice),
    loanAmount: Math.round(finalLoan),
    monthlyBreakdown: {
      principal_interest: Math.round(pi),
      property_tax: Math.round(monthlyTax),
      insurance: Math.round(monthlyInsurance),
      pmi: Math.round(finalPMI),
      hoa: monthlyHOA,
    },
    ltv: finalLoan / maxPrice,
    comfortableRange: [Math.round(maxPrice * 0.9), Math.round(maxPrice)],
    stretchRange: [Math.round(maxPrice), Math.round(maxPrice * 1.15)],
  }
}

/**
 * Calculate affordability per city
 */
export function calculatePerCity(inputs: AffordabilityInputs): CityAffordability[] {
  const cities = inputs.targetCities || Object.keys(MA_TAX_RATES).slice(0, 5)

  return cities.map((city) => {
    const taxRate = MA_TAX_RATES[city] || DEFAULT_TAX_RATE
    const result = calculateAffordability({
      ...inputs,
      targetCities: [city],
    })

    return {
      city,
      maxPrice: result.maxHomePrice,
      comfortablePrice: result.comfortableRange[1],
      stretchPrice: result.stretchRange[1],
      monthlyTax: result.monthlyBreakdown.property_tax,
      taxRate,
    }
  })
}

// --- Helpers ---

function calculateMonthlyPI(
  loanAmount: number,
  monthlyRate: number,
  numPayments: number
): number {
  if (monthlyRate === 0) return loanAmount / numPayments
  return (
    loanAmount *
    (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1)
  )
}

function solveForMaxPrice(
  targetMonthly: number,
  downPayment: number,
  monthlyRate: number,
  numPayments: number,
  monthlyTaxPerDollar: number,
  monthlyInsurance: number,
  monthlyHOA: number
): number {
  // Available for P&I + Tax = targetMonthly - insurance - HOA
  const availableForPIAndTax = targetMonthly - monthlyInsurance - monthlyHOA

  // P&I = f(loanAmount) = f(homePrice - downPayment)
  // Tax = homePrice * monthlyTaxPerDollar
  // availableForPIAndTax = PI(homePrice - downPayment) + homePrice * taxPerDollar
  //
  // Let H = homePrice, D = downPayment, L = H - D
  // PI(L) = L * [r(1+r)^n / ((1+r)^n - 1)]  = L * M  where M is the mortgage factor
  // Available = (H - D) * M + H * T
  // Available = H*M - D*M + H*T
  // Available + D*M = H * (M + T)
  // H = (Available + D*M) / (M + T)

  const M =
    monthlyRate === 0
      ? 1 / numPayments
      : (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
        (Math.pow(1 + monthlyRate, numPayments) - 1)

  const homePrice = (availableForPIAndTax + downPayment * M) / (M + monthlyTaxPerDollar)

  return Math.max(homePrice, 0)
}

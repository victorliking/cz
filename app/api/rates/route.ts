import { NextResponse } from "next/server"
import { getCurrentMortgageRates } from "@/lib/financial/mortgage-rates"

export const revalidate = 86400 // Cache for 24 hours at edge

export async function GET() {
  const rates = await getCurrentMortgageRates()
  return NextResponse.json(rates)
}

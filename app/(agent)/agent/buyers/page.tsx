import { prisma } from "@/lib/prisma"
import { cookies } from "next/headers"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function AgentBuyersPage() {
  const cookieStore = cookies()
  const userId = cookieStore.get("homematch_user")?.value
  if (!userId) return <p>Not authenticated</p>

  const buyers = await prisma.buyerProfile.findMany({
    where: { agentId: userId },
    include: { user: true },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Your Buyers</h1>
      <p className="text-slate-500 mb-8">Click a buyer to see their full portrait and search brief.</p>

      {buyers.length === 0 && (
        <div className="border border-dashed rounded-lg p-8 text-center">
          <p className="text-slate-400">No buyers assigned yet.</p>
        </div>
      )}

      <div className="grid gap-4">
        {buyers.map((buyer) => {
          const answers = (buyer.answers as Record<string, any>) || {}
          const budget = answers.budget || {}
          const cities = (answers.target_areas || []) as string[]
          const bedrooms = answers.bedrooms_min || "?"

          return (
            <Link key={buyer.id} href={`/agent/buyers/${buyer.id}`}>
              <div className="border rounded-lg p-4 hover:border-slate-400 hover:shadow-sm transition-all cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {buyer.user.name || buyer.user.email || buyer.userId}
                    </p>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {cities.join(", ") || "No areas set"} · {bedrooms}+ BR · 
                      {budget.budgetRange ? ` $${Math.round(budget.budgetRange[0]/1000)}k–$${Math.round(budget.budgetRange[1]/1000)}k` : " Budget TBD"}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">{buyer.status}</span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

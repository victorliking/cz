import { prisma } from "@/lib/prisma"
import { cookies } from "next/headers"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PortraitCard } from "@/components/portrait/PortraitCard"
import { MatchList } from "@/components/matches/MatchList"

export const dynamic = "force-dynamic"

export default async function BuyerDashboard() {
  const cookieStore = cookies()
  const userId = cookieStore.get("homematch_user")?.value

  if (!userId) return <p>Not authenticated</p>

  const user = await prisma.user.findUnique({ where: { id: userId } })
  const profile = await prisma.buyerProfile.findFirst({
    where: { userId },
    include: { intakeResponse: true },
  })

  const hasCompletedIntake = !!profile?.intakeResponse?.completedAt

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">HomeMatch</h1>
          <p className="text-sm text-slate-500">Welcome, {user?.name}</p>
        </div>
        <Link href="/switch" className="text-xs text-slate-400 hover:text-slate-600">
          Switch →
        </Link>
      </div>

      <div className="max-w-lg mx-auto p-6 space-y-6">
        {/* Intake CTA or status */}
        {!hasCompletedIntake ? (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-lg text-blue-900">
                🏠 Let&apos;s discover what you really want
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-blue-700">
                Answer 12 quick questions to help us understand your priorities.
                Takes about 5 minutes — and we&apos;ll share insights as you go.
              </p>
              <Link href="/buyer/intake">
                <Button className="w-full">Start Intake Questionnaire →</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Your Self Portrait</h2>
              <Link href="/buyer/intake" className="text-xs text-blue-600 hover:underline">
                Retake →
              </Link>
            </div>
            <p className="text-xs text-slate-500 -mt-4">
              Based on your intake. This evolves as you see homes.
            </p>
            <PortraitCard />

            {/* Matched Listings */}
            <MatchList />

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Upcoming Showings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-400 italic">No showings scheduled yet.</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  )
}

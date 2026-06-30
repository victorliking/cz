import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PortraitCard } from "@/components/portrait/PortraitCard"
import { MatchList } from "@/components/matches/MatchList"
import { BuyerLogShowing } from "@/components/feedback/ShowingFeedbackForm"
import { SignOutButton } from "@/components/auth/SignOutButton"

export const dynamic = "force-dynamic"

export default async function BuyerDashboard() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id

  if (!userId) return <p>Not authenticated</p>

  const user = await prisma.user.findUnique({ where: { id: userId } })
  let profile = await prisma.buyerProfile.findFirst({
    where: { userId },
    include: { intakeResponse: true },
  })

  if (!profile) {
    const created = await prisma.buyerProfile.create({
      data: { userId, agentId: userId },
    })
    profile = { ...created, intakeResponse: null }
  }

  const hasCompletedIntake = !!profile?.intakeResponse?.completedAt

  return (
    <main className="min-h-screen bg-[#f5f5f7]">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-[640px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-[#1d1d1f]">HomeMatch</span>
            {hasCompletedIntake && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">
                Profile Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#86868b]">{user?.name}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="max-w-[640px] mx-auto px-6 py-12 space-y-10">
        {!hasCompletedIntake ? (
          /* Onboarding state */
          <div className="pt-4 space-y-10">
            <div className="text-center space-y-4">
              <h1 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">
                Let&apos;s find out what you&apos;re really looking for
              </h1>
              <p className="text-base text-[#86868b] max-w-md mx-auto leading-relaxed">
                Most home searches start with beds and budget. We start with how you live &mdash;
                then match you to homes that actually fit.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-10 space-y-8 shadow-sm">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF] text-sm font-semibold shrink-0 mt-0.5">1</div>
                  <div>
                    <p className="font-medium text-[#1d1d1f]">Take the intake questionnaire</p>
                    <p className="text-sm text-[#86868b] mt-0.5">~5 minutes. Lifestyle questions, not just specs.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-[#f5f5f7] flex items-center justify-center text-[#86868b] text-sm font-semibold shrink-0 mt-0.5">2</div>
                  <div>
                    <p className="font-medium text-[#86868b]">Get your buyer portrait</p>
                    <p className="text-sm text-[#86868b]/60 mt-0.5">A clear read on your priorities and trade-offs.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-[#f5f5f7] flex items-center justify-center text-[#86868b] text-sm font-semibold shrink-0 mt-0.5">3</div>
                  <div>
                    <p className="font-medium text-[#86868b]">See your matches</p>
                    <p className="text-sm text-[#86868b]/60 mt-0.5">Listings scored against your profile.</p>
                  </div>
                </div>
              </div>

              <Link href="/buyer/intake" className="block">
                <Button className="w-full h-12 text-sm font-medium rounded-xl bg-[#1d1d1f] hover:bg-[#333336] text-white transition-all">
                  Start Questionnaire
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          /* Active state — has completed intake */
          <>
            {/* Portrait section */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-[#1d1d1f] tracking-tight">Your Buyer Portrait</h2>
                <Link href="/buyer/intake" className="text-sm text-[#007AFF] hover:text-[#0056b3] transition-all">
                  Retake
                </Link>
              </div>
              <PortraitCard />
            </section>

            {/* Matches section */}
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-[#1d1d1f] tracking-tight">Your Matches</h2>
                <span className="text-xs text-[#86868b]">Seen one in person? Tell us how it felt.</span>
              </div>
              {/* Feed the learning loop: a guided, chip-based showing log tied to
                  a real listing so its dimension scores reach the matcher. */}
              <BuyerLogShowing />
              <MatchList />
            </section>
          </>
        )}
      </div>
    </main>
  )
}

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"

export default async function Home() {
  const session = await getServerSession(authOptions)

  if (session?.user) {
    const profile = await prisma.buyerProfile.findFirst({
      where: { userId: session.user.id },
    })
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (user?.role === "AGENT") redirect("/agent")
    if (profile) redirect("/buyer")
    redirect("/switch")
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <span className="text-lg font-semibold tracking-tight text-[#1d1d1f]">HomeMatch</span>
        <Link
          href="/login"
          className="text-sm font-normal text-[#86868b] hover:text-[#1d1d1f] transition-all"
        >
          Sign In
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-[680px] mx-auto px-6 pt-32 pb-20 text-center">
        <p className="text-sm font-medium text-[#86868b] mb-4 tracking-wide">
          AI-Powered Buyer Matching
        </p>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-[#1d1d1f] leading-[1.1]">
          Find homes that match<br />
          <span className="text-[#007AFF]">how you actually live</span>
        </h1>
        <p className="mt-8 text-lg text-[#86868b] max-w-[520px] mx-auto leading-relaxed">
          Most home searches start with beds, baths, and budget. We start with you &mdash;
          your lifestyle, priorities, and trade-offs &mdash; then match you to homes that fit.
        </p>
        <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl bg-[#1d1d1f] h-12 px-8 text-sm font-medium text-white hover:bg-[#333336] transition-all"
          >
            Get Started
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex items-center justify-center rounded-xl h-12 px-8 text-sm font-medium text-[#1d1d1f] border border-slate-100 hover:bg-[#f5f5f7] transition-all"
          >
            How It Works
          </a>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-[#f5f5f7] py-24">
        <div className="max-w-[720px] mx-auto px-6">
          <h2 className="text-3xl font-semibold text-[#1d1d1f] text-center mb-16 tracking-tight">
            Three steps to better matches
          </h2>
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center mx-auto text-[#007AFF] font-semibold text-lg">
                1
              </div>
              <h3 className="font-semibold text-[#1d1d1f]">Tell us how you live</h3>
              <p className="text-sm text-[#86868b] leading-relaxed">
                5-minute questionnaire about your lifestyle, priorities, and deal-breakers. No jargon, no pressure.
              </p>
            </div>
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center mx-auto text-[#007AFF] font-semibold text-lg">
                2
              </div>
              <h3 className="font-semibold text-[#1d1d1f]">Get your buyer portrait</h3>
              <p className="text-sm text-[#86868b] leading-relaxed">
                AI generates insights about what you really need &mdash; including blind spots you didn&apos;t know you had.
              </p>
            </div>
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center mx-auto text-[#007AFF] font-semibold text-lg">
                3
              </div>
              <h3 className="font-semibold text-[#1d1d1f]">See homes that fit</h3>
              <p className="text-sm text-[#86868b] leading-relaxed">
                Listings scored against your unique profile. The system learns from your feedback and gets smarter over time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 text-center text-sm text-[#86868b]">
        HomeMatch &copy; 2026. Built for buyers who want more than a filter.
      </footer>
    </main>
  )
}

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { RoleSelector } from "./RoleSelector"

export const dynamic = "force-dynamic"

export default async function SwitchPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })

  if (!user) redirect("/login")

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#f5f5f7]">
      <div className="w-full max-w-[480px] space-y-10">
        <div className="text-center space-y-3">
          <span className="text-lg font-semibold text-[#1d1d1f]">HomeMatch</span>
          <h1 className="text-3xl font-semibold text-[#1d1d1f] mt-8 tracking-tight">How will you use HomeMatch?</h1>
          <p className="text-base text-[#86868b] leading-relaxed">
            Hi {user.name || "there"} &mdash; this helps us set up the right experience for you.
          </p>
        </div>
        <RoleSelector userId={user.id} />
      </div>
    </main>
  )
}

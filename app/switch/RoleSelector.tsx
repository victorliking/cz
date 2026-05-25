"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export function RoleSelector({ userId }: { userId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function selectRole(role: "BUYER" | "AGENT") {
    setLoading(role)
    await fetch("/api/auth/set-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    })
    router.push(role === "AGENT" ? "/agent" : "/buyer")
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => selectRole("BUYER")}
        disabled={loading !== null}
        className="w-full bg-white rounded-2xl shadow-sm p-8 text-left hover:shadow-md transition-all disabled:opacity-50 group"
      >
        <div className="flex items-start gap-5">
          <div className="w-12 h-12 rounded-xl bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF] shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-[#1d1d1f] text-base">I&apos;m looking for a home</p>
            <p className="text-sm text-[#86868b] mt-1.5 leading-relaxed">
              Take the intake questionnaire and get matched to homes that fit your lifestyle.
            </p>
          </div>
        </div>
        {loading === "BUYER" && <p className="text-xs text-[#007AFF] mt-4">Setting up your profile...</p>}
      </button>

      <button
        onClick={() => selectRole("AGENT")}
        disabled={loading !== null}
        className="w-full bg-white rounded-2xl shadow-sm p-8 text-left hover:shadow-md transition-all disabled:opacity-50 group"
      >
        <div className="flex items-start gap-5">
          <div className="w-12 h-12 rounded-xl bg-[#f5f5f7] flex items-center justify-center text-[#86868b] shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-[#1d1d1f] text-base">I&apos;m a buyer&apos;s agent</p>
            <p className="text-sm text-[#86868b] mt-1.5 leading-relaxed">
              Manage buyers, add listings, and see AI-generated match insights.
            </p>
          </div>
        </div>
        {loading === "AGENT" && <p className="text-xs text-[#86868b] mt-4">Setting up your dashboard...</p>}
      </button>
    </div>
  )
}

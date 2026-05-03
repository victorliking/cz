"use client"

import { useRouter } from "next/navigation"
import { IntakeWizard } from "@/components/intake/IntakeWizard"
import { useEffect, useState } from "react"

export default function IntakePage() {
  const router = useRouter()
  const [profileId, setProfileId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch the buyer's profile ID
    fetch("/api/intake/profile")
      .then((res) => res.json())
      .then((data) => {
        if (data.profileId) {
          setProfileId(data.profileId)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleComplete = async (answers: Record<string, unknown>) => {
    const res = await fetch("/api/intake/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, buyerProfileId: profileId }),
    })

    if (!res.ok) {
      const err = await res.json()
      alert(err.error || "Failed to submit intake")
      return
    }

    router.push("/buyer")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Loading...</p>
      </div>
    )
  }

  if (!profileId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-900 mb-2">No profile found</h1>
          <p className="text-slate-500">Your agent needs to set up your buyer profile first.</p>
        </div>
      </div>
    )
  }

  return <IntakeWizard buyerProfileId={profileId} onComplete={handleComplete} />
}

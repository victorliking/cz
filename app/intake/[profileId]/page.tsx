"use client"

import { useParams, useRouter } from "next/navigation"
import { IntakeWizard } from "@/components/intake/IntakeWizard"
import { useEffect, useState } from "react"

export default function PublicIntakePage() {
  const params = useParams()
  const router = useRouter()
  const profileId = params.profileId as string
  const [valid, setValid] = useState<boolean | null>(null)
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    fetch(`/api/intake/validate?profileId=${profileId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setValid(true)
          if (data.alreadyCompleted) setCompleted(true)
        } else {
          setValid(false)
        }
      })
      .catch(() => setValid(false))
  }, [profileId])

  const handleComplete = async (answers: Record<string, unknown>) => {
    const res = await fetch("/api/intake/public-submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, buyerProfileId: profileId }),
    })

    if (!res.ok) {
      const err = await res.json()
      alert(err.error || "Failed to submit intake")
      return
    }

    setCompleted(true)
  }

  if (valid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Loading...</p>
      </div>
    )
  }

  if (!valid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Invalid link</h1>
          <p className="text-slate-500">This intake link is not valid or has expired. Please contact your agent for a new link.</p>
        </div>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-green-600 text-2xl">&#10003;</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">All done!</h1>
          <p className="text-slate-500">Your preferences have been submitted. Your agent will use this to find homes that match what you&apos;re looking for.</p>
        </div>
      </div>
    )
  }

  return <IntakeWizard buyerProfileId={profileId} onComplete={handleComplete} />
}

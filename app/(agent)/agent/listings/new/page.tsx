"use client"

import { useRouter } from "next/navigation"
import { ListingForm } from "@/components/forms/ListingForm"

export default function NewListingPage() {
  const router = useRouter()

  const handleSubmit = async (data: any) => {
    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    if (!res.ok) {
      const err = await res.json()
      alert(err.error || "Failed to create listing")
      return
    }

    const { id } = await res.json()
    router.push(`/agent/listings/${id}`)
  }

  return (
    <main className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">New Listing</h1>
        <p className="text-muted-foreground mt-1">
          Enter listing details step by step. Your expert observations (sensory scores) are high-signal data.
        </p>
      </div>
      <ListingForm onSubmit={handleSubmit} />
    </main>
  )
}

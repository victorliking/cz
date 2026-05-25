"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface Buyer {
  id: string
  status: string
  intakeCompletedAt: string | null
  notes: string | null
  user: { name: string | null; email: string; phone: string | null }
  intakeResponse: { completedAt: string | null } | null
}

export default function AgentBuyersPage() {
  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", notes: "" })
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const fetchBuyers = async () => {
    const res = await fetch("/api/buyers/list")
    if (res.ok) {
      const data = await res.json()
      setBuyers(data.buyers)
    }
    setLoading(false)
  }

  useEffect(() => { fetchBuyers() }, [])

  const handleAddBuyer = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const res = await fetch("/api/buyers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    })
    if (res.ok) {
      setFormData({ name: "", email: "", phone: "", notes: "" })
      setShowForm(false)
      fetchBuyers()
    } else {
      const err = await res.json()
      alert(err.error || "Failed to add buyer")
    }
    setSubmitting(false)
  }

  const copyLink = (profileId: string) => {
    const link = `${window.location.origin}/intake/${profileId}`
    navigator.clipboard.writeText(link)
    setCopied(profileId)
    setTimeout(() => setCopied(null), 2000)
  }

  const getStatus = (buyer: Buyer) => {
    if (buyer.intakeResponse?.completedAt) return { label: "Complete", color: "bg-green-100 text-green-700" }
    if (buyer.intakeResponse) return { label: "In progress", color: "bg-yellow-100 text-yellow-700" }
    return { label: "Not started", color: "bg-slate-100 text-slate-600" }
  }

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-slate-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">Your Buyers</h1>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="h-10 px-6 rounded-xl bg-[#1d1d1f] hover:bg-[#333336] text-white text-sm font-medium"
        >
          {showForm ? "Cancel" : "Add Buyer"}
        </Button>
      </div>
      <p className="text-[#86868b] mb-8">Manage buyers and share intake links.</p>

      {showForm && (
        <form onSubmit={handleAddBuyer} className="mb-8 p-6 bg-[#f5f5f7] rounded-2xl space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Name</label>
              <input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Jane Smith"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="jane@example.com"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(617) 555-0123"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Notes</label>
              <input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Referred by..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={submitting}
            className="h-10 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
          >
            {submitting ? "Adding..." : "Create Buyer & Generate Link"}
          </Button>
        </form>
      )}

      {buyers.length === 0 && !showForm && (
        <div className="border border-dashed border-slate-200 rounded-2xl p-12 text-center">
          <p className="text-[#86868b] mb-4">No buyers yet. Add your first buyer to get started.</p>
          <Button
            onClick={() => setShowForm(true)}
            className="h-10 px-6 rounded-xl bg-[#1d1d1f] hover:bg-[#333336] text-white text-sm font-medium"
          >
            Add Buyer
          </Button>
        </div>
      )}

      <div className="grid gap-3">
        {buyers.map((buyer) => {
          const status = getStatus(buyer)
          return (
            <div key={buyer.id} className="border border-slate-100 rounded-2xl p-5 hover:shadow-sm transition-all bg-white">
              <div className="flex items-center justify-between">
                <Link href={`/agent/buyers/${buyer.id}`} className="flex-1 min-w-0">
                  <p className="font-semibold text-[#1d1d1f] truncate">
                    {buyer.user.name || buyer.user.email}
                  </p>
                  <p className="text-sm text-[#86868b] mt-0.5 truncate">
                    {buyer.user.email}
                    {buyer.user.phone ? ` · ${buyer.user.phone}` : ""}
                  </p>
                </Link>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.color}`}>
                    {status.label}
                  </span>
                  <button
                    onClick={() => copyLink(buyer.id)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all"
                  >
                    {copied === buyer.id ? "Copied!" : "Copy Link"}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

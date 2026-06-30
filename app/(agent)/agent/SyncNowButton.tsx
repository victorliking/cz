"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

type SyncResult = {
  ok: boolean
  message: string
}

export function SyncNowButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)

  async function sync() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch("/api/listings/sync-now", { method: "POST" })
      const data = await res.json().catch(() => ({}))

      if (res.status === 429) {
        setResult({ ok: false, message: data.error || "Synced recently — please wait." })
      } else if (!res.ok) {
        // The endpoint passes through the cron's own status/message (e.g.
        // missing credentials, download failure) so the agent sees the reason.
        setResult({ ok: false, message: data.error || `Sync failed (HTTP ${res.status}).` })
      } else {
        const s = data.summary
        if (s) {
          const note = s.staleNote ? ` ${s.staleNote}` : ""
          const errs = s.errors?.length ? ` ${s.errors.length} error(s).` : ""
          setResult({
            ok: true,
            message: `Synced ${s.synced} listings (${s.new} new, ${s.updated} updated) from ${s.filesProcessed?.length ?? 0} file(s) in ${Math.round((s.durationMs ?? 0) / 1000)}s.${note}${errs}`,
          })
        } else {
          setResult({ ok: true, message: "Sync completed." })
        }
        // Refresh the server component so the freshness card updates.
        router.refresh()
      }
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : "Sync request failed." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        onClick={sync}
        disabled={loading}
        variant="outline"
        className="h-10 px-5 rounded-xl border-slate-200 text-[#1d1d1f] hover:bg-[#f5f5f7] text-sm font-medium"
      >
        {loading ? "Syncing…" : "Sync now"}
      </Button>
      {result && (
        <p className={`text-xs max-w-xs text-right ${result.ok ? "text-[#86868b]" : "text-red-600"}`}>
          {result.message}
        </p>
      )}
    </div>
  )
}

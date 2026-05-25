"use client"

import { signOut } from "next-auth/react"

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="text-sm text-[#86868b] hover:text-[#1d1d1f] transition-all"
    >
      Sign out
    </button>
  )
}

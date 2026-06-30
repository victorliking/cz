import Link from "next/link"

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-100 flex flex-col">
        <div className="p-6">
          <Link href="/agent" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#1d1d1f] rounded-lg flex items-center justify-center text-white font-semibold text-xs">
              HM
            </div>
            <span className="font-semibold text-[#1d1d1f]">HomeMatch</span>
          </Link>
          <p className="text-xs text-[#86868b] mt-1.5 ml-[42px]">Agent Portal</p>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <NavLink href="/agent">
            Dashboard
          </NavLink>
          <NavLink href="/agent/buyers">
            Buyers
          </NavLink>
          <NavLink href="/agent/listings">
            Listings
          </NavLink>
          <NavLink href="/agent/listings/new">
            New Listing
          </NavLink>
        </nav>

        <div className="p-5 border-t border-slate-100">
          <Link
            href="/switch"
            className="text-sm text-[#86868b] hover:text-[#1d1d1f] transition-all"
          >
            Switch Role
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-[#f5f5f7] overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

function NavLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#1d1d1f] hover:bg-[#f5f5f7] transition-all"
    >
      <span>{children}</span>
    </Link>
  )
}

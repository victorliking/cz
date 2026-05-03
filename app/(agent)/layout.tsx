import Link from "next/link"
import { cookies } from "next/headers"

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <Link href="/agent" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              HM
            </div>
            <span className="font-semibold text-lg">HomeMatch</span>
          </Link>
          <p className="text-xs text-slate-400 mt-1">Agent Portal</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavLink href="/agent" icon="📊">
            Dashboard
          </NavLink>
          <NavLink href="/agent/listings" icon="🏠">
            Listings
          </NavLink>
          <NavLink href="/agent/listings/new" icon="➕">
            New Listing
          </NavLink>
        </nav>

        <div className="p-4 border-t border-slate-700">
          <Link
            href="/switch"
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Switch Role →
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-slate-50 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string
  icon: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
    >
      <span>{icon}</span>
      <span>{children}</span>
    </Link>
  )
}

import Link from "next/link"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">HomeMatch</h1>
        <p className="text-muted-foreground text-lg max-w-md">
          Buyer Self-Discovery Platform
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/switch"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Switch User →
          </Link>
        </div>
      </div>
    </main>
  )
}

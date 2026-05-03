import { prisma } from "@/lib/prisma"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function SwitchPage() {
  const users = await prisma.user.findMany({
    orderBy: { role: "asc" },
    include: { buyerProfile: true },
  })

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">HomeMatch — Role Switcher</h1>
          <p className="text-sm text-muted-foreground">
            Select a user to continue (dev mode)
          </p>
        </div>

        {users.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground italic">
              No users yet. Run <code className="bg-muted px-1 rounded">npm run db:seed</code> to create test data.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <Link
                key={user.id}
                href={`/${user.role === "AGENT" ? "agent" : "buyer"}?as=${user.id}`}
                className="block w-full rounded-lg border p-4 hover:bg-accent transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded ${
                      user.role === "AGENT"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {user.role}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="text-center pt-4">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  )
}

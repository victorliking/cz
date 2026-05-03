export default function SwitchPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">Role Switcher</h1>
        <p className="text-muted-foreground">
          Select a user to continue (dev mode)
        </p>
        <p className="text-sm text-muted-foreground italic">
          Users will appear here after seeding the database.
        </p>
      </div>
    </main>
  )
}

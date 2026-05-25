import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { I18nWrapper } from "@/components/providers/I18nWrapper"
import { SessionProvider } from "@/components/providers/SessionProvider"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "HomeMatch",
  description: "Buyer Self-Discovery Platform",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>
          <I18nWrapper>{children}</I18nWrapper>
        </SessionProvider>
      </body>
    </html>
  )
}

import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { I18nWrapper } from "@/components/providers/I18nWrapper"

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
        <I18nWrapper>{children}</I18nWrapper>
      </body>
    </html>
  )
}

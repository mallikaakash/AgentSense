import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "AgentSense Platform",
  description: "Monetization layer for AI agents on Stellar",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen">{children}</body>
    </html>
  )
}

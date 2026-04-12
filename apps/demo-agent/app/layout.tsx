import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "AgentSense Demo - AI Agent",
  description: "Demo AI agent that queries paid content via AgentSense",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        {children}
      </body>
    </html>
  )
}

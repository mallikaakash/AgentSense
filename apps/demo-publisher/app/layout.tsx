import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Healthy Recipes Blog",
  description: "Delicious and nutritious recipes for a healthier you",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900 min-h-screen">{children}</body>
    </html>
  )
}

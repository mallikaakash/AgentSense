"use client"

import Link from "next/link"

export default function Home() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-16">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-bold mb-4">AgentSense</h1>
        <p className="text-xl text-gray-600 mb-2">
          AdSense for the agent web
        </p>
        <p className="text-gray-500">
          A monetization layer for content that AI agents read
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        <Link
          href="/dashboard/publisher"
          className="block p-8 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
        >
          <h2 className="text-2xl font-semibold mb-3">Publisher Dashboard</h2>
          <p className="text-gray-600">
            View earnings, queries, and transaction history. See how much your
            content earns when agents read it.
          </p>
          <span className="inline-block mt-4 text-blue-600 font-medium">
            Open Dashboard &rarr;
          </span>
        </Link>

        <Link
          href="/dashboard/advertiser"
          className="block p-8 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
        >
          <h2 className="text-2xl font-semibold mb-3">Advertiser Dashboard</h2>
          <p className="text-gray-600">
            Manage ad sessions, keywords, and budget. Track how your sponsored
            results perform with agent queries.
          </p>
          <span className="inline-block mt-4 text-green-600 font-medium">
            Open Dashboard &rarr;
          </span>
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h2 className="text-2xl font-semibold mb-6">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="text-3xl font-bold text-blue-600 mb-2">1</div>
            <h3 className="font-semibold mb-1">Agent queries content</h3>
            <p className="text-sm text-gray-600">
              An AI agent requests content from a publisher site. The publisher
              middleware returns HTTP 402 Payment Required.
            </p>
          </div>
          <div>
            <div className="text-3xl font-bold text-blue-600 mb-2">2</div>
            <h3 className="font-semibold mb-1">Payment on Stellar</h3>
            <p className="text-sm text-gray-600">
              The agent pays $0.01 USDC via x402 on Stellar. The publisher earns
              directly. Transaction is visible on-chain.
            </p>
          </div>
          <div>
            <div className="text-3xl font-bold text-blue-600 mb-2">3</div>
            <h3 className="font-semibold mb-1">Auction + Sponsored slot</h3>
            <p className="text-sm text-gray-600">
              AgentSense runs an auction. The highest-bidding advertiser&apos;s
              sponsored result is injected into the response.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}

"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"

interface Publisher {
  id: string
  name: string
  domain: string
  walletAddress: string
  totalEarnings: number
  totalQueries: number
}

interface QueryLog {
  id: string
  query: string
  txHash: string | null
  publisherPayment: number
  adPayment: number
  sponsoredContent: string | null
  createdAt: string
}

interface Stats {
  publisher: Publisher
  recentQueries: QueryLog[]
  summary: {
    totalQueries: number
    totalEarnings: number
    averageEarningPerQuery: number
  }
}

const PUBLISHER_ID = "pub_recipes"

export default function PublisherDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/publisher/${PUBLISHER_ID}/stats`)
      if (res.ok) {
        setStats(await res.json())
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 3000)
    return () => clearInterval(interval)
  }, [fetchStats])

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        <p className="text-gray-500">Loading publisher dashboard...</p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        <p className="text-red-500">Failed to load publisher data.</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="mb-8">
        <Link href="/" className="text-blue-600 hover:underline text-sm">
          &larr; Back to Home
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-2">Publisher Dashboard</h1>
      <p className="text-gray-600 mb-8">
        {stats.publisher.name} &middot; {stats.publisher.domain}
      </p>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">Total Queries</p>
          <p className="text-4xl font-bold">{stats.summary.totalQueries}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">USDC Earned</p>
          <p className="text-4xl font-bold text-green-600">
            ${stats.summary.totalEarnings.toFixed(4)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">Avg Per Query</p>
          <p className="text-4xl font-bold text-blue-600">
            ${stats.summary.averageEarningPerQuery.toFixed(4)}
          </p>
        </div>
      </div>

      {/* Wallet info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-10">
        <h2 className="text-lg font-semibold mb-2">Wallet</h2>
        <p className="text-sm text-gray-600 font-mono break-all">
          {stats.publisher.walletAddress}
        </p>
      </div>

      {/* Recent queries */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Queries</h2>
        {stats.recentQueries.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No queries yet. Run the demo agent to see queries appear here in
            real time.
          </p>
        ) : (
          <div className="space-y-3">
            {stats.recentQueries.map((q) => (
              <div
                key={q.id}
                className="border border-gray-100 rounded-lg p-4"
              >
                <div className="flex justify-between items-start mb-2">
                  <p className="font-medium text-sm">&ldquo;{q.query}&rdquo;</p>
                  <span className="text-green-600 font-semibold text-sm whitespace-nowrap ml-4">
                    +${q.publisherPayment.toFixed(4)}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>
                    {new Date(q.createdAt).toLocaleTimeString()}
                  </span>
                  {q.txHash && (
                    <span className="font-mono truncate max-w-[200px]">
                      tx: {q.txHash}
                    </span>
                  )}
                  {q.sponsoredContent && (
                    <span className="text-orange-600">
                      Ad matched
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

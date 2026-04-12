"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"

interface Session {
  id: string
  keywords: string[]
  bidPerQuery: number
  totalBudget: number
  remainingBudget: number
  sponsoredContent: string
  status: string
  queriesMatched: number
  createdAt: string
}

interface QueryLog {
  id: string
  query: string
  publisherId: string
  adPayment: number
  sponsoredContent: string | null
  createdAt: string
}

interface Stats {
  advertiser: {
    id: string
    name: string
    walletAddress: string
  }
  sessions: Session[]
  recentQueries: QueryLog[]
  summary: {
    activeSessions: number
    totalSpent: number
    totalQueriesMatched: number
    totalRemainingBudget: number
  }
}

const ADVERTISER_ID = "adv_muscleblaze"

export default function AdvertiserDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/advertiser/${ADVERTISER_ID}/stats`)
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
        <p className="text-gray-500">Loading advertiser dashboard...</p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        <p className="text-red-500">Failed to load advertiser data.</p>
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

      <h1 className="text-3xl font-bold mb-2">Advertiser Dashboard</h1>
      <p className="text-gray-600 mb-8">{stats.advertiser.name}</p>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">Active Sessions</p>
          <p className="text-4xl font-bold">{stats.summary.activeSessions}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">Queries Matched</p>
          <p className="text-4xl font-bold text-blue-600">
            {stats.summary.totalQueriesMatched}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">USDC Spent</p>
          <p className="text-4xl font-bold text-orange-600">
            ${stats.summary.totalSpent.toFixed(4)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">Remaining Budget</p>
          <p className="text-4xl font-bold text-green-600">
            ${stats.summary.totalRemainingBudget.toFixed(4)}
          </p>
        </div>
      </div>

      {/* Active sessions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-10">
        <h2 className="text-lg font-semibold mb-4">Sessions</h2>
        <div className="space-y-4">
          {stats.sessions.map((session) => (
            <div
              key={session.id}
              className="border border-gray-100 rounded-lg p-4"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-medium text-sm">
                    {session.sponsoredContent}
                  </p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {session.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded ${
                    session.status === "active"
                      ? "bg-green-50 text-green-700"
                      : session.status === "depleted"
                        ? "bg-red-50 text-red-700"
                        : "bg-gray-50 text-gray-700"
                  }`}
                >
                  {session.status}
                </span>
              </div>

              {/* Budget bar */}
              <div className="mb-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>
                    ${(session.totalBudget - session.remainingBudget).toFixed(2)}{" "}
                    spent
                  </span>
                  <span>${session.totalBudget.toFixed(2)} total</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${((session.totalBudget - session.remainingBudget) / session.totalBudget) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-4 text-xs text-gray-500">
                <span>Bid: ${session.bidPerQuery.toFixed(4)}/query</span>
                <span>Matched: {session.queriesMatched} queries</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent matched queries */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Matched Queries</h2>
        {stats.recentQueries.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No matched queries yet. Run the demo agent to see matches appear
            here.
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
                  <span className="text-orange-600 font-semibold text-sm whitespace-nowrap ml-4">
                    -${q.adPayment.toFixed(4)}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {new Date(q.createdAt).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

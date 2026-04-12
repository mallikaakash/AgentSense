import { NextRequest, NextResponse } from "next/server"
import { store } from "@/lib/store"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const advertiser = store.getAdvertiser(id)

  if (!advertiser) {
    return NextResponse.json({ error: "Advertiser not found" }, { status: 404 })
  }

  const sessions = store.getSessionsForAdvertiser(id)
  const recentQueries = store.getQueriesForAdvertiser(id)

  const totalSpent = sessions.reduce(
    (sum, s) => sum + (s.totalBudget - s.remainingBudget),
    0
  )
  const totalQueriesMatched = sessions.reduce(
    (sum, s) => sum + s.queriesMatched,
    0
  )

  return NextResponse.json({
    advertiser,
    sessions,
    recentQueries: recentQueries.slice(0, 50),
    summary: {
      activeSessions: sessions.filter((s) => s.status === "active").length,
      totalSpent,
      totalQueriesMatched,
      totalRemainingBudget: sessions.reduce(
        (sum, s) => sum + s.remainingBudget,
        0
      ),
    },
  })
}

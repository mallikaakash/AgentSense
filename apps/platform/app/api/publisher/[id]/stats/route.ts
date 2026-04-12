import { NextRequest, NextResponse } from "next/server"
import { store } from "@/lib/store"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const publisher = store.getPublisher(id)

  if (!publisher) {
    return NextResponse.json({ error: "Publisher not found" }, { status: 404 })
  }

  const recentQueries = store.getQueriesForPublisher(id)

  return NextResponse.json({
    publisher,
    recentQueries: recentQueries.slice(0, 50),
    summary: {
      totalQueries: publisher.totalQueries,
      totalEarnings: publisher.totalEarnings,
      averageEarningPerQuery:
        publisher.totalQueries > 0
          ? publisher.totalEarnings / publisher.totalQueries
          : 0,
    },
  })
}

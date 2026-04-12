import { NextRequest, NextResponse } from "next/server"
import { createX402Client, PaymentStep } from "@/lib/x402-client"

const PUBLISHER_URL =
  process.env.PUBLISHER_URL || "http://localhost:3002"

const AGENT_SECRET = process.env.AGENT_SECRET || ""

export async function POST(request: NextRequest) {
  const { query } = await request.json()

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 })
  }

  if (!AGENT_SECRET) {
    return NextResponse.json(
      { error: "AGENT_SECRET not configured" },
      { status: 500 }
    )
  }

  const contentUrl = `${PUBLISHER_URL}/api/content?q=${encodeURIComponent(query)}`
  const steps: PaymentStep[] = []

  try {
    const { fetchPaidContent } = createX402Client(AGENT_SECRET)

    const result = await fetchPaidContent(contentUrl, (step) => {
      steps.push(step)
    })

      return NextResponse.json({
        steps,
        content: result.content,
        sponsoredContent: result.sponsoredContent,
        advertiserId: result.advertiserId,
        sessionId: result.sessionId,
        mppVoucher: result.mppVoucher ?? null,
        payment: {
          txHash: result.txHash,
          amount: result.amount,
        },
      })
  } catch (error) {
    steps.push({
      type: "error",
      message: error instanceof Error ? error.message : "Query failed",
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json({ steps, error: "Query failed" }, { status: 500 })
  }
}

// POST /api/channel/create
// Advertiser creates a new MPP payment channel by depositing USDC

import { NextRequest, NextResponse } from "next/server"
import {
  createChannel,
  USDC_CONTRACT_TESTNET,
  type Channel,
} from "@/lib/mpp-channel"
import { store } from "@/lib/store"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { advertiserId, budget, keywords, bidPerQuery, sponsoredContent } = body

    if (!advertiserId || !budget) {
      return NextResponse.json(
        { error: "Missing advertiserId or budget" },
        { status: 400 }
      )
    }

    const advertiser = store.getAdvertiser(advertiserId)
    if (!advertiser) {
      return NextResponse.json(
        { error: "Advertiser not found" },
        { status: 404 }
      )
    }

    // Convert budget to stroops (USDC has 7 decimals)
    const budgetStroops = Math.floor(Number(budget) * 10_000_000).toString()

    // Create the channel
    const channel = createChannel({
      advertiserId,
      advertiserKey: advertiser.walletAddress,
      recipientKey: process.env.PUBLISHER_WALLET || "GCM5SIFSH3ZB2BITJNP46SD7L4T2FPGNQJ3KHWG4RBHQTNG4PPKNUJQZ",
      totalBudget: budgetStroops,
      usdcContractAddress: USDC_CONTRACT_TESTNET,
    })

    // Also create a session in the store to track the campaign
    // This keeps the auction logic working with the existing store.runAuction
    const session = store.createSession({
      advertiserId,
      keywords: keywords || ["protein", "fitness", "recipe", "health", "nutrition"],
      bidPerQuery: bidPerQuery ?? 0.005,
      totalBudget: Number(budget),
      sponsoredContent: sponsoredContent || "Sponsored content",
    })

    return NextResponse.json({
      channelId: channel.id,
      sessionId: session.id,
      status: channel.status,
      totalBudget: channel.totalBudget,
      remaining: channel.remaining,
      usdcContract: channel.token,
      message: `Channel created. Advertiser should fund via Stellar transfer to ${channel.recipientKey}`,
    })
  } catch (error) {
    console.error("Channel create error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// GET /api/channel/create?advertiserId=xxx
// Get all channels for an advertiser
export async function GET(request: NextRequest) {
  const advertiserId = request.nextUrl.searchParams.get("advertiserId")

  if (!advertiserId) {
    return NextResponse.json(
      { error: "Missing advertiserId" },
      { status: 400 }
    )
  }

  const { getChannelsByAdvertiser } = await import("@/lib/mpp-channel")
  const channels = getChannelsByAdvertiser(advertiserId)

  return NextResponse.json({ channels })
}
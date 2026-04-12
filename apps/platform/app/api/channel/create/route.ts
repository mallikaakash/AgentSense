// POST /api/channel/create
// Advertiser creates a new MPP payment channel using the deployed
// on-chain one-way-channel contract (CAFZZDYGZSULXCBEN7BNTBDX2DWUTWKTAQQY5ZY7NFXPCTY4RLORFAIJ).
//
// The channel is already funded on-chain (deposited during contract deployment).
// This endpoint registers the channel in the platform's tracker and creates
// a campaign session for the auction system.

import { NextRequest, NextResponse } from "next/server"
import {
  createChannel,
  CHANNEL_CONTRACT_TESTNET,
  USDC_CONTRACT_TESTNET,
  type Channel,
} from "@/lib/mpp-channel"
import { store } from "@/lib/store"

const PLATFORM_KEY = process.env.PUBLISHER_WALLET || "GCM5SIFSH3ZB2BITJNP46SD7L4T2FPGNQJ3KHWG4RBHQTNG4PPKNUJQZ"

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

    // Create the channel using the REAL deployed contract address as ID
    const channel = createChannel({
      advertiserId,
      advertiserKey: advertiser.walletAddress,
      recipientKey: PLATFORM_KEY,
      totalBudget: budgetStroops,
      usdcContractAddress: USDC_CONTRACT_TESTNET,
      onChainChannelId: CHANNEL_CONTRACT_TESTNET, // Use real contract address
    })

    // Also create a session in the store to track the campaign
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
      onChainContract: CHANNEL_CONTRACT_TESTNET,
      message: `Channel is the deployed on-chain contract at ${CHANNEL_CONTRACT_TESTNET}. Already funded with USDC. Use the commitment key to sign off-chain payments.`,
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
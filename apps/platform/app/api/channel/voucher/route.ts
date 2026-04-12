// POST /api/channel/voucher
// Platform issues a voucher for a query match against an MPP channel
// The advertiser's commitment signature is verified, then a voucher is created

import { NextRequest, NextResponse } from "next/server"
import {
  createVoucher,
  verifyVoucher,
  getChannel,
  USDC_CONTRACT_TESTNET,
} from "@/lib/mpp-channel"
import { store } from "@/lib/store"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { channelId, amount, cumulativeAmount, signature, advertiserPublicKey, queryId } = body

    if (!channelId || !amount || !cumulativeAmount || !signature || !advertiserPublicKey) {
      return NextResponse.json(
        { error: "Missing required fields: channelId, amount, cumulativeAmount, signature, advertiserPublicKey" },
        { status: 400 }
      )
    }

    // Verify the channel exists
    const channel = getChannel(channelId)
    if (!channel) {
      return NextResponse.json(
        { error: "Channel not found" },
        { status: 404 }
      )
    }

    if (channel.status !== "open") {
      return NextResponse.json(
        { error: `Channel is ${channel.status}` },
        { status: 400 }
      )
    }

    // Verify the commitment signature
    const valid = verifyVoucher({
      channelId,
      cumulativeAmount,
      signature,
      advertiserPublicKey,
    })

    if (!valid) {
      return NextResponse.json(
        { error: "Invalid voucher signature" },
        { status: 401 }
      )
    }

    // Check budget hasn't been exceeded
    if (BigInt(cumulativeAmount) > BigInt(channel.totalBudget)) {
      return NextResponse.json(
        { error: "Channel budget exceeded" },
        { status: 400 }
      )
    }

    // Create the voucher
    const voucher = createVoucher({
      channelId,
      paymentAmount: amount,
      advertiserSecret: "", // Not needed for creation since signature is already verified
      queryId,
    })

    return NextResponse.json({
      voucherId: voucher.voucherId,
      amount: voucher.amount,
      cumulativeAmount: voucher.cumulativeAmount,
      signature: voucher.signature,
      channelRemaining: channel.remaining,
      status: "issued",
    })
  } catch (error) {
    console.error("Voucher create error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}

// GET /api/channel/voucher?channelId=xxx
// List all vouchers for a channel
export async function GET(request: NextRequest) {
  const channelId = request.nextUrl.searchParams.get("channelId")

  if (!channelId) {
    return NextResponse.json(
      { error: "Missing channelId" },
      { status: 400 }
    )
  }

  const channel = getChannel(channelId)
  if (!channel) {
    return NextResponse.json(
      { error: "Channel not found" },
      { status: 404 }
    )
  }

  return NextResponse.json({
    channelId,
    vouchers: channel.vouchers,
    totalVouchers: channel.vouchers.length,
    totalSpent: channel.spent,
    remaining: channel.remaining,
  })
}
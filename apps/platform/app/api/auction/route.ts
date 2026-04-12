import { NextRequest, NextResponse } from "next/server"
import { runAuction } from "@/lib/auction"
import { store } from "@/lib/store"
import {
  createVoucher,
  signCommitment,
} from "@/lib/mpp-channel"

// Publisher share of the advertiser fee (0.6 - 0.8%)
const PUBLISHER_FEE_SHARE = 0.007 // 0.7%

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, publisherId, walletAddress, txHash, sessionId, advertiserId } = body

    if (!query) {
      return NextResponse.json(
        { error: "Missing query" },
        { status: 400 }
      )
    }

    // Resolve publisher
    let resolvedPublisherId = publisherId

    if (!resolvedPublisherId && walletAddress) {
      const existing = store.getPublisherByWallet(walletAddress)
      if (existing) {
        resolvedPublisherId = existing.id
      } else {
        const domain =
          request.headers.get("origin")?.replace(/^https?:\/\//, "") ?? "unknown"
        const walletShorthand = walletAddress.slice(0, 8)
        resolvedPublisherId = `pub_${walletShorthand}`
        store.registerPublisher({
          id: resolvedPublisherId,
          name: `Publisher ${walletShorthand}`,
          domain,
          walletAddress,
        })
      }
    }

    if (!resolvedPublisherId) {
      return NextResponse.json(
        { error: "Missing publisherId or walletAddress" },
        { status: 400 }
      )
    }

    // Run the auction — advertiser bid is deducted from their MPP session budget
    const result = runAuction(query, resolvedPublisherId)

    // ── MPP: Issue voucher for this ad payment ─────────────────────────────
    // The platform holds the advertiser's budget as MPP channel vouchers.
    // Each query match generates an off-chain signed commitment (voucher)
    // that the advertiser signed. This is the MPP "charge" mode working
    // with signed Soroban auth entries for the x402 payment.
    let mppVoucher: {
      voucherId: string
      cumulativeAmount: string
      signature: string
    } | null = null

    if (result.sessionId && result.advertiserId && result.deductedAmount > 0) {
      // Find the advertiser's channel (created via /api/channel/create)
      const { getChannelsByAdvertiser } = await import("@/lib/mpp-channel")
      const channels = getChannelsByAdvertiser(result.advertiserId)
      const activeChannel = channels.find((ch) => ch.status === "open")

      if (activeChannel) {
        const bidStroops = Math.floor(result.deductedAmount * 10_000_000).toString()
        const newCumulative = (BigInt(activeChannel.spent) + BigInt(bidStroops)).toString()

        // Check budget
        if (BigInt(newCumulative) <= BigInt(activeChannel.totalBudget)) {
          // Sign commitment as the platform (we hold the channel funds)
          // In real MPP, the advertiser signs the commitment (push mode)
          // For our MVP, the platform signs on behalf of the advertiser
          // since the advertiser deposited funds into the channel
          const prefix = `agentsense-channel-v1:${activeChannel.id}:voucher`
          const signature = signCommitment(
            "SCDLQYN23ZNH2VDO4WJXHQBJKDRYOQN2ZBU7AUHEFCVHZGIQB5QWZQSX", // advertiser's secret (signs commitment)
            prefix,
            newCumulative
          )

          // Create voucher via the mpp-channel library
          try {
            const voucher = createVoucher({
              channelId: activeChannel.id,
              paymentAmount: bidStroops,
              advertiserSecret: "SCDLQYN23ZNH2VDO4WJXHQBJKDRYOQN2ZBU7AUHEFCVHZGIQB5QWZQSX",
              queryId: `q_${Date.now()}`,
            })
            mppVoucher = {
              voucherId: voucher.voucherId,
              cumulativeAmount: voucher.cumulativeAmount,
              signature: voucher.signature,
            }
          } catch {
            // Voucher creation may fail if cumulative is already used
            // (duplicate call for same query) — skip silently
          }
        }
      }
    }

    // Publisher earns a % of the advertiser's bid, not their own per-query price
    const publisherEarning = result.deductedAmount * PUBLISHER_FEE_SHARE
    const platformFee = result.deductedAmount - publisherEarning

    // Record publisher earnings
    if (publisherEarning > 0) {
      store.recordPublisherPayment(resolvedPublisherId, publisherEarning)
    }

    // Log the query
    store.logQuery({
      publisherId: resolvedPublisherId,
      sessionId: result.sessionId,
      query,
      txHash: txHash ?? null,
      publisherPayment: publisherEarning,
      adPayment: result.deductedAmount,
      sponsoredContent: result.sponsoredContent,
      advertiserId: result.advertiserId,
    })

    return NextResponse.json({
      sponsoredContent: result.sponsoredContent,
      advertiserId: result.advertiserId,
      sessionId: result.sessionId,
      deductedAmount: result.deductedAmount,
      publisherEarning,
      platformFee,
      mppVoucher, // Included when a channel-based voucher was issued
    })
  } catch (error) {
    console.error("Auction error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

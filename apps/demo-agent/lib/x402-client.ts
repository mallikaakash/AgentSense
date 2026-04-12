// x402 payment client for demo-agent
// Handles 402 negotiation + Soroban auth entry signing for Stellar x402

import { wrapFetchWithPayment } from "@x402/fetch"
import { createEd25519Signer } from "@x402/stellar"
import { ExactStellarScheme } from "@x402/stellar/exact/client"
import { x402Client } from "@x402/core/client"

export interface PaymentStep {
  type: "info" | "payment" | "auction" | "content" | "error"
  message: string
  data?: Record<string, unknown>
  timestamp: string
}

export interface X402Result {
  content: unknown
  sponsoredContent: string | null
  advertiserId: string | null
  sessionId: string | null
  mppVoucher: {
    voucherId: string
    cumulativeAmount: string
    signature: string
  } | null
  txHash: string
  amount: string
}

/**
 * Creates an x402-aware fetch function that handles 402 negotiation transparently.
 * Step-by-step callbacks let the demo UI show the payment flow.
 */
export function createX402Client(agentSecret: string) {
  const signer = createEd25519Signer(agentSecret, "stellar:testnet")
  const scheme = new ExactStellarScheme(signer)
  const client = new x402Client().register("stellar:testnet", scheme)
  const payFetch = wrapFetchWithPayment(globalThis.fetch, client)

  return {
    async fetchPaidContent(
      url: string,
      onStep: (step: PaymentStep) => void
    ): Promise<X402Result> {
      onStep({
        type: "info",
        message: `Querying publisher: ${url}`,
        timestamp: new Date().toISOString(),
      })

      // wrapFetchWithPayment handles the 402 loop internally:
      // 1. Sends request
      // 2. If 402, calls handlePaymentRequired hooks
      // 3. If no hook headers, creates payment payload and retries with payment header
      // 4. Returns final response
      const res = await payFetch(url, {
        headers: {
          "User-Agent": "AgentSense-Demo-Agent/1.0",
          "X-Agent-Id": "demo-agent-001",
        },
      })

      // At this point res is either 200 (paid) or 402 (payment failed/cancelled)
      if (res.status === 402) {
        const details = await res.json().catch(() => ({}))
        const paymentDetails = details.paymentDetails ?? details ?? {}
        const amount = paymentDetails.amount ?? "0.01"

        onStep({
          type: "payment",
          message: "402 Payment Required received",
          data: {
            amount,
            currency: paymentDetails.currency ?? "USDC",
            network: paymentDetails.network ?? "stellar:testnet",
            recipient: paymentDetails.recipient ?? "unknown",
          },
          timestamp: new Date().toISOString(),
        })

        onStep({
          type: "error",
          message: `Payment required but not completed: ${res.status}`,
          timestamp: new Date().toISOString(),
        })

        throw new Error(`Payment required but not completed: ${res.status}`)
      }

      if (!res.ok) {
        onStep({
          type: "error",
          message: `Request failed: ${res.status}`,
          timestamp: new Date().toISOString(),
        })
        throw new Error(`Request failed: ${res.status}`)
      }

      const result = await res.json()

      // Extract tx hash — first from payment response header (via wrapFetchWithPayment
      // internal settlement), then fallback to top-level txHash in body (from our
      // middleware's processSettlement which returns the real on-chain tx hash)
      const txHash =
        res.headers.get("X-Payment-Response") ??
        res.headers.get("PAYMENT-RESPONSE") ??
        result.txHash ??
        ""

      onStep({
        type: "content",
        message: "Content received",
        timestamp: new Date().toISOString(),
      })

      if (result.sponsoredContent) {
        onStep({
          type: "auction",
          message: "Auction matched: sponsored result injected",
          data: {
            sponsoredContent: result.sponsoredContent,
            advertiserId: result.advertiserId,
          },
          timestamp: new Date().toISOString(),
        })
      } else {
        onStep({
          type: "auction",
          message: "No matching advertiser for this query",
          timestamp: new Date().toISOString(),
        })
      }

      return {
        content: result.content,
        sponsoredContent: result.sponsoredContent ?? null,
        advertiserId: result.advertiserId ?? null,
        sessionId: result.sessionId ?? null,
        mppVoucher: result.mppVoucher ?? null,
        txHash,
        amount: result.amount ?? "0.01",
      }
    },
  }
}

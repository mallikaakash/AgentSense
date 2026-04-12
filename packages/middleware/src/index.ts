// @agentsense/middleware
// Self-contained x402 payment gating middleware for publishers
// - Detects agent requests
// - Returns x402 402 challenge (price set by platform)
// - Verifies payment via OZ Channels facilitator
// - Calls AgentSense auction API for sponsored results
// - Serves content + ad slot to agent

import {
  x402ResourceServer,
  x402HTTPResourceServer,
  HTTPFacilitatorClient,
  type HTTPAdapter,
} from "@x402/core/server"
import { ExactStellarScheme } from "@x402/stellar/exact/server"

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface AgentGateConfig {
  /** Publisher's Stellar wallet address (G...) — used as publisher ID */
  wallet: string
  /** AgentSense platform URL (optional, defaults to production) */
  platformUrl?: string
}

export interface ContentResponse {
  content: unknown
  sponsoredContent?: string | null
  advertiserId?: string | null
  payment?: {
    txHash: string
    amount: string
    recipient: string
  }
}

// ---------------------------------------------------------------------------
// x402 server (lazy singleton — one per serverless cold start is fine)
// ---------------------------------------------------------------------------

const FACILITATOR_URL = "https://channels.openzeppelin.com/x402/testnet"
const NETWORK: "stellar:testnet" = "stellar:testnet"
const DEFAULT_PLATFORM_URL = "https://agentsense.xyz"

let _server: x402HTTPResourceServer | null = null
let _serverWallet: string | null = null
let _initPromise: Promise<void> | null = null

function createFacilitator() {
  const apiKey = process.env.CHANNELS_API_KEY
  return new HTTPFacilitatorClient({
    url: FACILITATOR_URL,
    createAuthHeaders: apiKey
      ? async () => ({
          verify: { Authorization: `Bearer ${apiKey}` },
          settle: { Authorization: `Bearer ${apiKey}` },
          supported: { Authorization: `Bearer ${apiKey}` },
        })
      : undefined,
  })
}

function getServer(wallet: string): x402HTTPResourceServer {
  if (_server && _serverWallet === wallet) return _server

  const facilitator = createFacilitator()
  const core = new x402ResourceServer(facilitator)
  const scheme = new ExactStellarScheme()
  core.register(NETWORK, scheme)

  // Start initialization (fetches supported payment kinds from facilitator)
  // Promise is stored so concurrent calls await the same init
  _initPromise = core.initialize()

  const routes = {
    [`*`]: {
      accepts: {
        scheme: "exact",
        payTo: wallet,
        price: "$0.01",
        network: NETWORK,
        extra: { areFeesSponsored: true },
      },
      description: "Publisher content access",
      mimeType: "application/json",
    },
  }

  _server = new x402HTTPResourceServer(core, routes)
  _serverWallet = wallet
  return _server
}

async function waitForServer(wallet: string): Promise<x402HTTPResourceServer> {
  const server = getServer(wallet)
  if (_initPromise) await _initPromise
  return server
}

// ---------------------------------------------------------------------------
// HTTP adapter — Next.js Request → x402 HTTPAdapter
// ---------------------------------------------------------------------------

function createAdapter(request: Request): HTTPAdapter {
  const url = new URL(request.url)

  return {
    getHeader: (name: string) => {
      const lower = name.toLowerCase()
      if (lower === "payment-signature" || lower === "x-payment") {
        return (
          request.headers.get("x-payment") ??
          request.headers.get("payment-signature") ??
          undefined
        )
      }
      return request.headers.get(name) ?? undefined
    },
    getMethod: () => request.method,
    getPath: () => url.pathname,
    getUrl: () => request.url,
    getAcceptHeader: () => request.headers.get("accept") ?? "",
    getUserAgent: () => request.headers.get("user-agent") ?? "",
    getQueryParams: () => {
      const params: Record<string, string | string[]> = {}
      url.searchParams.forEach((value, key) => {
        const existing = params[key]
        params[key] = existing
          ? Array.isArray(existing)
            ? [...existing, value]
            : [existing, value]
          : value
      })
      return params
    },
    getQueryParam: (name: string) => {
      const values = url.searchParams.getAll(name)
      if (values.length === 0) return undefined
      if (values.length === 1) return values[0]
      return values
    },
  }
}

// ---------------------------------------------------------------------------
// Agent detection
// ---------------------------------------------------------------------------

function isAgentRequest(request: Request): boolean {
  const ua = request.headers.get("user-agent") ?? ""
  const agentId = request.headers.get("x-agent-id")
  if (agentId) return true
  const lower = ua.toLowerCase()
  return (
    lower.includes("agent") ||
    lower.includes("bot") ||
    lower.includes("gpt") ||
    lower.includes("claude") ||
    lower.includes("llm")
  )
}

// ---------------------------------------------------------------------------
// agentGate — the public API
// ---------------------------------------------------------------------------

/**
 * Wrap a Next.js App Router handler with AgentSense payment gating.
 *
 * Usage:
 * ```ts
 * import { agentGate } from '@agentsense/middleware'
 *
 * export const GET = agentGate({
 *   wallet: 'GXXX...',
 *   platformUrl: 'https://agentsense.xyz', // optional
 * }, async (request) => {
 *   const query = new URL(request.url).searchParams.get('q')
 *   return { title: 'My Article', body: '...' }
 * })
 * ```
 *
 * For non-agent requests: content served directly (no 402).
 * For agent requests: x402 payment challenge → verified → auction → content + ad slot.
 */
export function agentGate(
  config: AgentGateConfig,
  contentHandler: (request: Request) => Promise<unknown>
) {
  const platformUrl = config.platformUrl ?? DEFAULT_PLATFORM_URL

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url)
    const query =
      url.searchParams.get("q") ??
      url.searchParams.get("query") ??
      ""

    // ── Non-agent: serve content directly ───────────────────────────────────
    if (!isAgentRequest(request)) {
      const content = await contentHandler(request)
      return Response.json({ content })
    }

    // ── Agent: x402 payment flow ─────────────────────────────────────────
    const adapter = createAdapter(request)
    const httpServer = await waitForServer(config.wallet)

    const context = {
      adapter,
      path: url.pathname,
      method: request.method,
      paymentHeader: request.headers.get("x-payment") ?? undefined,
    }

    const result = await httpServer.processHTTPRequest(context)

    if (result.type === "payment-error") {
      return new Response(JSON.stringify(result.response.body), {
        status: result.response.status,
        headers: result.response.headers,
      })
    }

    if (result.type === "no-payment-required") {
      // Shouldn't happen for agent requests with x402 configured, but handle it
      const content = await contentHandler(request)
      return Response.json({ content })
    }

    // ── Payment verified: run auction + serve content ───────────────────────
    const content = await contentHandler(request)
    let auctionData: {
      sponsoredContent: string | null
      advertiserId: string | null
      sessionId: string | null
      mppVoucher?: {
        voucherId: string
        cumulativeAmount: string
        signature: string
      } | null
    } = { sponsoredContent: null, advertiserId: null, sessionId: null }

    try {
      const auctionRes = await fetch(`${platformUrl}/api/auction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          walletAddress: config.wallet, // platform uses wallet as publisher ID
          txHash: null, // settlement happens async via facilitator
        }),
      })
      if (auctionRes.ok) {
        auctionData = await auctionRes.json()
      }
    } catch (err) {
      console.error("[agentGate] auction call failed:", err)
    }

    // Settle payment and capture tx hash for the response
    let paymentInfo: { txHash: string; amount: string; recipient: string } = {
      txHash: "",
      amount: "$0.01",
      recipient: config.wallet,
    }

    try {
      const settleResult = await httpServer.processSettlement(
        result.paymentPayload,
        result.paymentRequirements,
        result.declaredExtensions
      )

      if (settleResult.success && settleResult.transaction) {
        paymentInfo.txHash = settleResult.transaction
      }
    } catch (err) {
      console.error("[agentGate] settlement failed:", err)
    }

    return Response.json(
      {
        content,
        sponsoredContent: auctionData.sponsoredContent,
        advertiserId: auctionData.advertiserId,
        sessionId: auctionData.sessionId,
        mppVoucher: auctionData.mppVoucher ?? null,
        txHash: paymentInfo.txHash, // Include in body — headers don't survive Response.json()
        payment: {
          txHash: paymentInfo.txHash,
          amount: paymentInfo.amount,
          recipient: paymentInfo.recipient,
        },
      },
      {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    )
  }
}

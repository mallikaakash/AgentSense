// Thin wrapper around store.runAuction for clean imports
import { store } from "./store"

export interface AuctionResult {
  sponsoredContent: string | null
  advertiserId: string | null
  sessionId: string | null
  deductedAmount: number
}

export function runAuction(
  query: string,
  publisherId: string
): AuctionResult {
  const result = store.runAuction(query, publisherId)

  return {
    sponsoredContent: result.sponsoredContent,
    advertiserId: result.session?.advertiserId ?? null,
    sessionId: result.session?.id ?? null,
    deductedAmount: result.deductedAmount,
  }
}

// Stellar MPP Channel implementation for AgentSense
// Implements the one-way payment channel pattern from @stellar/mpp
// Uses Ed25519 signatures over commitment data for off-chain voucher auth
// On-chain settlement via Stellar payment transactions

import { Keypair, TransactionBuilder, Networks, BASE_FEE, Operation } from "@stellar/stellar-sdk"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Channel {
  id: string
  advertiserId: string
  advertiserKey: string // G... public key
  recipientKey: string   // G... (platform's wallet)
  totalBudget: string    // total deposited in stroops
  spent: string          // cumulative spent in stroops
  remaining: string     // remaining in stroops
  token: string          // USDC contract address C...
  status: "open" | "closed" | "disputed"
  createdAt: string
  updatedAt: string
  vouchers: Voucher[]
}

export interface Voucher {
  id: string
  channelId: string
  amount: string        // stroops
  cumulativeAmount: string // total committed including this
  signature: string     // Ed25519 signature (128 hex chars)
  queryId: string | null
  redeemed: boolean
  redeemedAt: string | null
  createdAt: string
}

export interface ChannelOpenResult {
  channelId: string
  transactionXdr: string // base64 for client to sign
  openAmount: string
}

export interface VoucherResult {
  voucherId: string
  amount: string
  cumulativeAmount: string
  signature: string
}

// ---------------------------------------------------------------------------
// Commitment signing — Ed25519 over commitment data
// ---------------------------------------------------------------------------

const CHANNEL_PREFIX = "agentsense-channel-v1"
const VOUCHER_PREFIX = "agentsense-voucher-v1"
const CLOSE_PREFIX = "agentsense-channel-close-v1"

/**
 * Build the commitment bytes for signing.
 * Format: UTF-8 prefix + action + amount (padded to 64 bytes)
 */
function buildCommitmentBytes(prefix: string, amount: string): Uint8Array {
  const amountBigInt = BigInt(amount)
  const amountHex = amountBigInt.toString(16).padStart(64, "0")
  const amountBytes = new Uint8Array(Buffer.from(amountHex, "hex"))
  const prefixBytes = new TextEncoder().encode(prefix)
  const result = new Uint8Array(prefixBytes.length + amountBytes.length)
  result.set(prefixBytes, 0)
  result.set(amountBytes, prefixBytes.length)
  return result
}

/**
 * Sign a commitment with the advertiser's keypair.
 * Returns 128 hex chars (64 bytes) representing the Ed25519 signature.
 */
export function signCommitment(
  secretKey: string,
  prefix: string,
  amount: string
): string {
  const keypair = Keypair.fromSecret(secretKey)
  const data = buildCommitmentBytes(prefix, amount)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signature = keypair.sign(data as any)
  const sig = signature as unknown as { length: number; [n: number]: number }
  const hexParts: string[] = []
  for (let i = 0; i < sig.length; i++) {
    hexParts.push(sig[i].toString(16).padStart(2, "0"))
  }
  return hexParts.join("")
}

/**
 * Verify a commitment signature against an advertiser's public key.
 */
export function verifyCommitment(
  publicKey: string,
  prefix: string,
  amount: string,
  signatureHex: string
): boolean {
  try {
    const keypair = Keypair.fromPublicKey(publicKey)
    const data = buildCommitmentBytes(prefix, amount)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return keypair.verify(data as any, Buffer.from(signatureHex, "hex") as any)
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Channel creation (on-chain deposit via payment)
// ---------------------------------------------------------------------------

/**
 * Create a channel by making a payment to the recipient.
 * The "escrow" is just a regular Stellar payment from advertiser to recipient.
 * For MVP, we use a simple payment-based approach where the advertiser sends
 * their full budget to the platform's wallet. The platform tracks the budget
 * separately and issues vouchers.
 *
 * The real on-chain settlement happens when vouchers are redeemed — the platform
 * makes a payment back to the publisher from the received funds.
 */
export async function openChannel(opts: {
  advertiserSecret: string
  recipientPublicKey: string
  amount: string // stroops
  usdcContractAddress: string
  rpcUrl?: string
}): Promise<{ channelId: string; txHash: string }> {
  const advertiser = Keypair.fromSecret(opts.advertiserSecret)
  const channelId = `ch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  // For MVP: just record the channel — on-chain deposit happens separately
  // The advertiser transfers USDC to the recipient, and we track it via Horizon
  // This is a placeholder — real implementation would use a Soroban contract
  // or at minimum, verify the payment via Horizon API

  return {
    channelId,
    txHash: `sim_open_${channelId}`, // Simulated for now
  }
}

// ---------------------------------------------------------------------------
// Voucher creation
// ---------------------------------------------------------------------------

/**
 * Create a voucher for a payment from the advertiser.
 * The advertiser signs a commitment for the cumulative amount.
 *
 * For MVP, we use an in-memory store. In production, this would use the
 * @stellar/mpp channel.server with Store persistence and on-chain verification.
 */
export function createVoucher(opts: {
  channelId: string
  paymentAmount: string // stroops
  advertiserSecret: string
  queryId?: string
}): VoucherResult {
  const keypair = Keypair.fromSecret(opts.advertiserSecret)

  // Find the channel
  const channel = channels.get(opts.channelId)
  if (!channel) throw new Error(`Channel not found: ${opts.channelId}`)

  // Calculate new cumulative amount
  const prevCumulative = BigInt(channel.spent)
  const newCumulative = prevCumulative + BigInt(opts.paymentAmount)

  // Check against remaining budget
  if (newCumulative > BigInt(channel.totalBudget)) {
    throw new Error("Channel budget exhausted")
  }

  // Sign the commitment
  const prefix = `${CHANNEL_PREFIX}:${opts.channelId}:voucher`
  const signature = signCommitment(
    opts.advertiserSecret,
    prefix,
    newCumulative.toString()
  )

  const voucherId = `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  const voucher: Voucher = {
    id: voucherId,
    channelId: opts.channelId,
    amount: opts.paymentAmount,
    cumulativeAmount: newCumulative.toString(),
    signature,
    queryId: opts.queryId ?? null,
    redeemed: false,
    redeemedAt: null,
    createdAt: new Date().toISOString(),
  }

  channel.vouchers.push(voucher)
  channel.spent = newCumulative.toString()
  channel.remaining = (BigInt(channel.totalBudget) - newCumulative).toString()
  channel.updatedAt = new Date().toISOString()

  return {
    voucherId,
    amount: opts.paymentAmount,
    cumulativeAmount: newCumulative.toString(),
    signature,
  }
}

// ---------------------------------------------------------------------------
// Voucher verification
// ---------------------------------------------------------------------------

/**
 * Verify a voucher signature against the advertiser's public key.
 * Also verifies the cumulative amount hasn't decreased (no rollback).
 */
export function verifyVoucher(opts: {
  channelId: string
  cumulativeAmount: string
  signature: string
  advertiserPublicKey: string
}): boolean {
  const channel = channels.get(opts.channelId)
  if (!channel) return false

  // Verify signature
  const prefix = `${CHANNEL_PREFIX}:${opts.channelId}:voucher`
  const valid = verifyCommitment(
    opts.advertiserPublicKey,
    prefix,
    opts.cumulativeAmount,
    opts.signature
  )

  if (!valid) return false

  // Verify cumulative amount is monotonically increasing
  const existingVouchers = channel.vouchers
  for (const v of existingVouchers) {
    if (BigInt(v.cumulativeAmount) >= BigInt(opts.cumulativeAmount)) {
      return false // Rollback detected
    }
  }

  return true
}

// ---------------------------------------------------------------------------
// Channel closing and settlement
// ---------------------------------------------------------------------------

/**
 * Close the channel and settle on-chain.
 * For MVP: we just mark the channel as closed and log the settlement.
 * In production: this would submit a Stellar transaction using the vouchers
 * to transfer the final amount from the channel escrow to the publisher.
 */
export function closeChannel(opts: {
  channelId: string
  recipientSecret: string // platform's secret to sign close tx
  rpcUrl?: string
}): { txHash: string; amountSettled: string } {
  const channel = channels.get(opts.channelId)
  if (!channel) throw new Error(`Channel not found: ${opts.channelId}`)
  if (channel.status !== "open") throw new Error("Channel is not open")

  // Mark all unredeemed vouchers as settled
  const now = new Date().toISOString()
  for (const v of channel.vouchers) {
    if (!v.redeemed) {
      v.redeemed = true
      v.redeemedAt = now
    }
  }

  channel.status = "closed"
  channel.updatedAt = now

  return {
    txHash: `sim_close_${opts.channelId}_${Date.now()}`,
    amountSettled: channel.spent,
  }
}

/**
 * Redeem a batch of vouchers on-chain.
 * For MVP: just marks them as redeemed in the store.
 * Production: would submit a Stellar tx using the signed vouchers.
 */
export function redeemVouchers(opts: {
  channelId: string
  voucherIds: string[]
}): { redeemed: string[]; totalAmount: string } {
  const channel = channels.get(opts.channelId)
  if (!channel) throw new Error(`Channel not found: ${opts.channelId}`)

  const now = new Date().toISOString()
  const redeemed: string[] = []
  let totalAmount = BigInt(0)

  for (const vid of opts.voucherIds) {
    const voucher = channel.vouchers.find((v) => v.id === vid)
    if (voucher && !voucher.redeemed) {
      voucher.redeemed = true
      voucher.redeemedAt = now
      redeemed.push(vid)
      totalAmount += BigInt(voucher.amount)
    }
  }

  return {
    redeemed,
    totalAmount: totalAmount.toString(),
  }
}

// ---------------------------------------------------------------------------
// In-memory channel store (MVP)
// ---------------------------------------------------------------------------

const channels = new Map<string, Channel>()

export function createChannel(opts: {
  advertiserId: string
  advertiserKey: string
  recipientKey: string
  totalBudget: string
  usdcContractAddress: string
}): Channel {
  const id = `ch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()
  const channel: Channel = {
    id,
    advertiserId: opts.advertiserId,
    advertiserKey: opts.advertiserKey,
    recipientKey: opts.recipientKey,
    totalBudget: opts.totalBudget,
    spent: "0",
    remaining: opts.totalBudget,
    token: opts.usdcContractAddress,
    status: "open",
    createdAt: now,
    updatedAt: now,
    vouchers: [],
  }
  channels.set(id, channel)
  return channel
}

export function getChannel(id: string): Channel | undefined {
  return channels.get(id)
}

export function getChannelsByAdvertiser(advertiserId: string): Channel[] {
  return Array.from(channels.values()).filter((c) => c.advertiserId === advertiserId)
}

export function getChannelsByStatus(status: Channel["status"]): Channel[] {
  return Array.from(channels.values()).filter((c) => c.status === status)
}

// ---------------------------------------------------------------------------
// Balance helpers
// ---------------------------------------------------------------------------

/**
 * Get remaining budget for a channel
 */
export function getChannelBalance(channelId: string): { total: string; spent: string; remaining: string } | null {
  const ch = channels.get(channelId)
  if (!ch) return null
  return {
    total: ch.totalBudget,
    spent: ch.spent,
    remaining: ch.remaining,
  }
}

// ---------------------------------------------------------------------------
// USDC constants
// ---------------------------------------------------------------------------

// USDC on Stellar testnet (CAP-0020 compliant)
export const USDC_CONTRACT_TESTNET = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"
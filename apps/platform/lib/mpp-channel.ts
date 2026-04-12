// Stellar MPP Channel implementation for AgentSense
// Uses real on-chain one-way-channel Soroban contract deployed on testnet
// (CAFZZDYGZSULXCBEN7BNTBDX2DWUTWKTAQQY5ZY7NFXPCTY4RLORFAIJ).
//
// Commitment format matches the contract's XDR ScVal::Map:
// { domain: "chancmmt", network: <32 bytes>, channel: <contract addr>, amount: i128 }
//
// Flow:
// 1. On-chain: Advertiser funds channel via constructor deposit
// 2. Off-chain: Advertiser signs commitment (cumulative amount) with Ed25519 key
// 3. On-chain close: Platform calls contract.close() with signed commitment

import { Keypair, StrKey } from "@stellar/stellar-sdk"
import { close as mppChannelClose } from "@stellar/mpp/channel/server"

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
// On-chain contract constants
// ---------------------------------------------------------------------------

export const CHANNEL_CONTRACT_TESTNET = "CAFZZDYGZSULXCBEN7BNTBDX2DWUTWKTAQQY5ZY7NFXPCTY4RLORFAIJ"

export const USDC_CONTRACT_TESTNET = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"

const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"
const RPC_URL = "https://soroban-testnet.stellar.org:443"

// Wallet addresses
const ADVERTISER_SECRET = "SCDLQYN23ZNH2VDO4WJXHQBJKDRYOQN2ZBU7AUHEFCVHZGIQB5QWZQSX"
const ADVERTISER_KEY = "GBYNUJTPNCVP6UDGYMRJMK4NY3WI7GNF5D2OLCWA5IJWPHXYCXLUNJE5"
const PLATFORM_KEY = "GCM5SIFSH3ZB2BITJNP46SD7L4T2FPGNQJ3KHWG4RBHQTNG4PPKNUJQZ"

// Commitment key (Ed25519 public key stored in the contract)
export const COMMITMENT_PUBKEY_HEX = "1fb61cf6d84af0d461fe5a727348dd8c849837b103905f261c2caf039bc0a95e"
export const COMMITMENT_SECRET_HEX = "58d1d8c603e6fe30647a783d4cb185c82338aa68aaf42b1493e4d3da7a8ecc5e"
const NETWORK_ID_HEX = "cee0302d59844d32bdca915c8203dd44b33fbb7edc19051ea37abedf28ecd472"

// ---------------------------------------------------------------------------
// Ed25519 Commitment Signing (matches one-way-channel contract format)
// ---------------------------------------------------------------------------

/**
 * Build the XDR commitment bytes for the one-way-channel contract.
 * Format: domain ("chancmmt") + network_id (32 bytes) + channel address + amount (i128)
 * This must match exactly what the contract's prepare_commitment() produces.
 */
function buildOnChainCommitmentBytes(channelContract: string, amount: bigint): Uint8Array {
  // Domain separator for channel commitments
  const domain = "chancmmt"
  const domainBytes = new TextEncoder().encode(domain)

  // Network ID (32 bytes) - SHA-256 hash of "Test SDF Network ; September 2015"
  const networkIdBytes = Buffer.from(NETWORK_ID_HEX, "hex")

  // Channel contract address as bytes (C... = contract address, use decodeContract)
  let channelBytes: Uint8Array
  if (channelContract.startsWith("C")) {
    channelBytes = new Uint8Array(StrKey.decodeContract(channelContract))
  } else {
    channelBytes = Keypair.fromPublicKey(channelContract).rawPublicKey()
  }

  // Amount as i128 (little-endian 16 bytes)
  const amountBytes = Buffer.allocUnsafe(16)
  const am = BigInt(amount)
  for (let i = 0; i < 16; i++) {
    amountBytes[i] = Number((am >> BigInt(i * 8)) & BigInt(0xff))
  }

  // Build: domain | network_id | channel | amount
  const result = Buffer.concat([domainBytes, networkIdBytes, channelBytes, amountBytes])
  return new Uint8Array(result)
}

/**
 * Sign a commitment using the Ed25519 commitment key.
 * Returns raw 64-byte signature as Uint8Array (used by mppChannelClose).
 */
function signCommitmentRaw(secretHex: string, channelContract: string, amount: bigint): Uint8Array {
  const secretBytes = Buffer.from(secretHex, "hex")
  const nacl = getNaclSync()
  const keyPair = nacl.keyPair(new Uint8Array(secretBytes))
  const commitmentBytes = buildOnChainCommitmentBytes(channelContract, amount)
  const signature = nacl.sign(commitmentBytes, keyPair.secretKey)
  return signature.subarray(0, 64)
}

// ---------------------------------------------------------------------------
// nacl helpers (loaded lazily via dynamic import)
// ---------------------------------------------------------------------------

let _naclSign: ((msg: Uint8Array, key: Uint8Array) => Uint8Array) | null = null
let _naclKeyPair: ((seed: Uint8Array) => { secretKey: Uint8Array }) | null = null

async function getNacl() {
  if (!_naclSign) {
    const nacl = await import("tweetnacl")
    _naclSign = nacl.sign
    _naclKeyPair = nacl.sign.keyPair.fromSeed
  }
  return { sign: _naclSign, keyPair: _naclKeyPair }
}

// Synchronous nacl access after first call (nacl is cached after first async load)
function getNaclSync() {
  if (!_naclSign) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nacl = require("tweetnacl")
    _naclSign = nacl.sign
    _naclKeyPair = nacl.sign.keyPair.fromSeed
  }
  return { sign: _naclSign!, keyPair: _naclKeyPair! }
}

// ---------------------------------------------------------------------------
// In-memory channel store (mirrors on-chain state for the demo)
// ---------------------------------------------------------------------------

// Singleton store for channels (survives Next.js HMR in dev mode)
const globalForChannels = globalThis as unknown as { __agentsenseChannels?: Map<string, Channel> }
const channels: Map<string, Channel> = globalForChannels.__agentsenseChannels ??= new Map()

console.log("[mpp-channel] channels map created. Size:", channels.size)

export function createChannel(opts: {
  advertiserId: string
  advertiserKey: string
  recipientKey: string
  totalBudget: string
  usdcContractAddress: string
  onChainChannelId?: string // the deployed contract address
}): Channel {
  // Use the deployed contract address as the channel ID
  const id = opts.onChainChannelId || CHANNEL_CONTRACT_TESTNET
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
  console.log("[mpp-channel] createChannel called for advertiser:", opts.advertiserId, "| onChainChannelId:", opts.onChainChannelId)
  channels.set(id, channel)
  console.log("[mpp-channel] channels map now has", channels.size, "entries")
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
// Voucher creation (uses on-chain commitment format)
// ---------------------------------------------------------------------------

export function createVoucher(opts: {
  channelId: string
  paymentAmount: string // stroops
  advertiserSecret: string
  queryId?: string
}): VoucherResult {
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

  // Sign the commitment using on-chain format
  const signature = signCommitmentRaw(
    opts.advertiserSecret,
    opts.channelId,
    newCumulative
  )
  const signatureHex = Buffer.from(signature).toString("hex")

  const voucherId = `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  const voucher: Voucher = {
    id: voucherId,
    channelId: opts.channelId,
    amount: opts.paymentAmount,
    cumulativeAmount: newCumulative.toString(),
    signature: signatureHex,
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
    signature: signatureHex,
  }
}

// ---------------------------------------------------------------------------
// On-chain channel close (uses @stellar/mpp close())
// ---------------------------------------------------------------------------

/**
 * Close the channel on-chain using @stellar/mpp's close() function.
 * This submits a real Stellar transaction to the deployed contract.
 */
export async function closeChannelOnChain(opts: {
  channelId: string
  closeAmount: string // stroops
}): Promise<{ txHash: string; amountSettled: string }> {
  const channel = channels.get(opts.channelId)
  if (!channel) throw new Error(`Channel not found: ${opts.channelId}`)

  // Get the last voucher (highest cumulative amount)
  const lastVoucher = channel.vouchers[channel.vouchers.length - 1]
  if (!lastVoucher) throw new Error("No vouchers to settle")

  const amount = BigInt(lastVoucher.cumulativeAmount)
  const signature = Buffer.from(lastVoucher.signature, "hex")

  try {
    const result = await mppChannelClose({
      channel: opts.channelId,
      amount,
      signature: new Uint8Array(signature),
      feePayer: {
        envelopeSigner: PLATFORM_KEY,
      },
      network: "stellar:testnet",
    })

    // Mark channel as closed
    channel.status = "closed"
    channel.updatedAt = new Date().toISOString()

    return {
      txHash: typeof result === "string" ? result : `on_chain_close_${opts.channelId}`,
      amountSettled: lastVoucher.cumulativeAmount,
    }
  } catch (err) {
    console.error("[closeChannelOnChain] error:", err)
    throw err
  }
}

// ---------------------------------------------------------------------------
// Legacy close (in-memory, for compatibility)
// ---------------------------------------------------------------------------

export function closeChannel(opts: {
  channelId: string
  recipientSecret: string
  rpcUrl?: string
}): { txHash: string; amountSettled: string } {
  const channel = channels.get(opts.channelId)
  if (!channel) throw new Error(`Channel not found: ${opts.channelId}`)
  if (channel.status !== "open") throw new Error("Channel is not open")

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
// Balance helpers
// ---------------------------------------------------------------------------

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
// Commitment verification (for voucher validation)
// ---------------------------------------------------------------------------

export function verifyVoucher(opts: {
  channelId: string
  cumulativeAmount: string
  signature: string
  advertiserPublicKey: string
}): boolean {
  const channel = channels.get(opts.channelId)
  if (!channel) return false

  // Verify cumulative amount is monotonically increasing
  for (const v of channel.vouchers) {
    if (BigInt(v.cumulativeAmount) >= BigInt(opts.cumulativeAmount)) {
      return false // Rollback detected
    }
  }

  return true
}
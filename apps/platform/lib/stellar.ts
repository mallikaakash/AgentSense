import * as StellarSdk from '@stellar/stellar-sdk'

// Testnet configuration
export const NETWORK = 'stellar:testnet'
export const HORIZON_URL = 'https://horizon-testnet.stellar.org'
export const RPC_URL = 'https://soroban-testnet.stellar.org'
export const FACILITATOR_URL = 'https://channels.openzeppelin.com/x402'
export const USDC_SAC = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA' // Testnet USDC SAC

export const server = new StellarSdk.Horizon.Server(HORIZON_URL)
export const rpc = new StellarSdk.rpc.Server(RPC_URL)

// Helper to fund an account with Friendbot
export async function fundWithFriendbot(publicKey: string) {
  const response = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`)
  if (!response.ok) {
    throw new Error('Failed to fund account with Friendbot')
  }
  return response.json()
}

// Helper to create trustline for USDC
export async function createUsdcTrustline(secretKey: string) {
  const keypair = StellarSdk.Keypair.fromSecret(secretKey)
  const account = await server.loadAccount(keypair.publicKey())

  const transaction = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset: new StellarSdk.Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'),
        limit: '1000000', // 1M USDC
      })
    )
    .setTimeout(30)
    .build()

  transaction.sign(keypair)
  return server.submitTransaction(transaction)
}

// Helper to get USDC balance
export async function getUsdcBalance(publicKey: string) {
  const account = await server.loadAccount(publicKey)
  const usdcBalance = account.balances.find(
    (balance: any) => balance.asset_code === 'USDC' && balance.asset_issuer === 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
  )
  return usdcBalance ? parseFloat(usdcBalance.balance) : 0
}
#!/usr/bin/env tsx

// Script to set up testnet accounts for AgentSense
// Run with: npx tsx scripts/setup-testnet.ts

import * as StellarSdk from '@stellar/stellar-sdk'
import { fundWithFriendbot, createUsdcTrustline, getUsdcBalance } from '../lib/stellar'

// Generate keypairs for testing
const agentKeypair = StellarSdk.Keypair.random()
const publisherKeypair = StellarSdk.Keypair.random()
const advertiserKeypair = StellarSdk.Keypair.random()

console.log('Generated test accounts:')
console.log('Agent:', agentKeypair.publicKey())
console.log('Publisher:', publisherKeypair.publicKey())
console.log('Advertiser:', advertiserKeypair.publicKey())

async function setupAccount(keypair: StellarSdk.Keypair, label: string) {
  console.log(`\nSetting up ${label}...`)

  try {
    // Fund with Friendbot
    console.log('Funding with Friendbot...')
    await fundWithFriendbot(keypair.publicKey())
    console.log('✓ Funded')

    // Create USDC trustline
    console.log('Creating USDC trustline...')
    await createUsdcTrustline(keypair.secret())
    console.log('✓ Trustline created')

    // Check balance
    const balance = await getUsdcBalance(keypair.publicKey())
    console.log(`USDC balance: ${balance}`)

  } catch (error) {
    console.error(`Error setting up ${label}:`, error)
  }
}

async function main() {
  await setupAccount(agentKeypair, 'Agent')
  await setupAccount(publisherKeypair, 'Publisher')
  await setupAccount(advertiserKeypair, 'Advertiser')

  console.log('\nSetup complete!')
  console.log('Save these secrets securely (for demo only):')
  console.log('Agent secret:', agentKeypair.secret())
  console.log('Publisher secret:', publisherKeypair.secret())
  console.log('Advertiser secret:', advertiserKeypair.secret())
}

main().catch(console.error)
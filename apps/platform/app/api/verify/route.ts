import { NextRequest, NextResponse } from "next/server"
import { server } from "@/lib/stellar"

export async function POST(request: NextRequest) {
  try {
    const { txHash, expectedAmount, recipient, mode } = await request.json()

    if (!txHash || !expectedAmount || !recipient) {
      return NextResponse.json(
        { error: "Missing txHash, expectedAmount, or recipient" },
        { status: 400 }
      )
    }

    // Simulated mode: accept any tx hash that starts with "sim_"
    if (mode === "simulated" || txHash.startsWith("sim_")) {
      return NextResponse.json({
        verified: true,
        txHash,
        mode: "simulated",
      })
    }

    // Real mode: verify on Stellar testnet
    try {
      const tx = await server.transactions().transaction(txHash).call()

      if (!tx.successful) {
        return NextResponse.json({
          verified: false,
          error: "Transaction failed on-chain",
        })
      }

      // Verify payment operations
      const operations = await server
        .operations()
        .forTransaction(txHash)
        .call()

      const paymentOp = operations.records.find(
        (op: any) =>
          (op.type === "payment" || op.type === "invoke_host_function") &&
          op.to === recipient
      )

      if (!paymentOp) {
        return NextResponse.json({
          verified: false,
          error: "No matching payment found in transaction",
        })
      }

      return NextResponse.json({
        verified: true,
        txHash,
        mode: "testnet",
        ledger: tx.ledger,
      })
    } catch (stellarError) {
      console.error("Stellar verification error:", stellarError)
      return NextResponse.json({
        verified: false,
        error: "Could not verify transaction on Stellar",
      })
    }
  } catch (error) {
    console.error("Verification error:", error)
    return NextResponse.json(
      { verified: false, error: "Verification failed" },
      { status: 500 }
    )
  }
}

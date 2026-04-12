import { NextRequest, NextResponse } from "next/server"
import { store } from "@/lib/store"

export async function POST(request: NextRequest) {
  try {
    const { id, name, domain, walletAddress } = await request.json()

    if (!id || !name || !domain || !walletAddress) {
      return NextResponse.json(
        { error: "Missing required fields: id, name, domain, walletAddress" },
        { status: 400 }
      )
    }

    const existing = store.getPublisher(id)
    if (existing) {
      return NextResponse.json({ publisher: existing })
    }

    const publisher = store.registerPublisher({ id, name, domain, walletAddress })
    return NextResponse.json({ publisher }, { status: 201 })
  } catch (error) {
    console.error("Publisher register error:", error)
    return NextResponse.json(
      { error: "Failed to register publisher" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { store } from "@/lib/store"

export async function POST(request: NextRequest) {
  try {
    const { advertiserId, keywords, bidPerQuery, totalBudget, sponsoredContent } =
      await request.json()

    if (!advertiserId || !keywords || !bidPerQuery || !totalBudget || !sponsoredContent) {
      return NextResponse.json(
        { error: "Missing required fields: advertiserId, keywords, bidPerQuery, totalBudget, sponsoredContent" },
        { status: 400 }
      )
    }

    // Verify advertiser exists
    let advertiser = store.getAdvertiser(advertiserId)
    if (!advertiser) {
      // Auto-register for demo convenience
      advertiser = store.registerAdvertiser({
        id: advertiserId,
        name: advertiserId,
        walletAddress: "GDEMO_" + advertiserId.toUpperCase(),
      })
    }

    const session = store.createSession({
      advertiserId,
      keywords,
      bidPerQuery,
      totalBudget,
      sponsoredContent,
    })

    return NextResponse.json({ session })
  } catch (error) {
    console.error("Session create error:", error)
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    )
  }
}

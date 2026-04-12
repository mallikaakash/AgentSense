import { NextResponse } from "next/server"
import { store } from "@/lib/store"

export async function GET() {
  const queries = store.getRecentQueries(100)
  return NextResponse.json({ queries })
}

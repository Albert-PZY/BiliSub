import { NextResponse } from "next/server"
import { clearSession } from "@/lib/server/session"

export const runtime = "nodejs"

export async function POST() {
  const response = NextResponse.json({ status: "missing" })
  clearSession(response)
  return response
}

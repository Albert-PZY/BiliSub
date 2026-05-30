import { NextResponse } from "next/server"
import { BilibiliError, fetchAccountSummary } from "@/lib/server/bilibili"
import { clearSession, readSession, writeSession } from "@/lib/server/session"

export const runtime = "nodejs"

export async function POST() {
  const session = await readSession()
  if (!session?.cookies || Object.keys(session.cookies).length === 0) {
    return NextResponse.json({
      status: "missing",
      account: null,
      last_error: null,
    })
  }

  try {
    const account = await fetchAccountSummary(session.cookies)
    const response = NextResponse.json({
      status: "active",
      account,
      last_error: null,
    })
    writeSession(response, {
      ...session,
      account,
      updated_at: new Date().toISOString(),
    })
    return response
  } catch (error) {
    const response = NextResponse.json({
      status: "expired",
      account: null,
      last_error: error instanceof Error ? error.message : "登录态已失效",
    })
    if (error instanceof BilibiliError) {
      clearSession(response)
    }
    return response
  }
}

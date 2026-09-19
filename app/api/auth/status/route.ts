import { NextRequest } from "next/server"
import { BilibiliError, fetchAccountSummary } from "@/lib/server/bilibili"
import { clearSession, createSessionToken, readSession, writeSession } from "@/lib/server/session"
import { jsonResponse, optionsResponse, rejectDisallowedOrigin, sessionTokenPayload } from "@/lib/cors"

export const runtime = "nodejs"

export async function OPTIONS(request: NextRequest) {
  return optionsResponse(request)
}

export async function POST(request: NextRequest) {
  const originError = rejectDisallowedOrigin(request)
  if (originError) return originError
  const session = await readSession(request)
  if (!session?.cookies || Object.keys(session.cookies).length === 0) {
    return jsonResponse(request, { status: "missing", account: null, last_error: null })
  }

  try {
    const account = await fetchAccountSummary(session.cookies)
    const refreshed = { ...session, account, updated_at: new Date().toISOString() }
    const sessionToken = createSessionToken(refreshed)
    const response = jsonResponse(request, {
      status: "active",
      account,
      last_error: null,
      ...sessionTokenPayload(request, sessionToken),
    })
    writeSession(response, refreshed, sessionToken)
    return response
  } catch (error) {
    const response = jsonResponse(request, {
      status: "expired",
      account: null,
      last_error: error instanceof Error ? error.message : "登录态已失效",
    })
    if (error instanceof BilibiliError) clearSession(response)
    return response
  }
}

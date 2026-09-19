import { NextRequest } from "next/server"
import { BilibiliError, pollQrLogin } from "@/lib/server/bilibili"
import { createSessionToken, writeSession } from "@/lib/server/session"
import { jsonResponse, optionsResponse, rejectDisallowedOrigin, sessionTokenPayload } from "@/lib/cors"

export const runtime = "nodejs"

export async function OPTIONS(request: NextRequest) {
  return optionsResponse(request)
}

export async function POST(request: NextRequest) {
  const originError = rejectDisallowedOrigin(request)
  if (originError) return originError
  try {
    const payload = (await request.json().catch(() => ({}))) as { qrcode_key?: string }
    const result = await pollQrLogin(String(payload.qrcode_key ?? ""))
    const session = result.status === "success" && result.cookies
      ? {
          cookies: result.cookies,
          account: result.account,
          updated_at: new Date().toISOString(),
        }
      : null
    const sessionToken = session ? createSessionToken(session) : null
    const response = jsonResponse(request, {
      status: result.status,
      account: result.account,
      message: result.message,
      ...sessionTokenPayload(request, sessionToken),
    })
    if (session && sessionToken) writeSession(response, session, sessionToken)
    return response
  } catch (error) {
    return jsonResponse(
      request,
      { error: error instanceof Error ? error.message : "登录轮询失败" },
      { status: error instanceof BilibiliError ? 409 : 500 },
    )
  }
}

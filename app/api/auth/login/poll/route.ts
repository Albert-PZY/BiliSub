import { NextRequest, NextResponse } from "next/server"
import { BilibiliError, pollQrLogin } from "@/lib/server/bilibili"
import { writeSession } from "@/lib/server/session"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json().catch(() => ({}))) as { qrcode_key?: string }
    const result = await pollQrLogin(String(payload.qrcode_key ?? ""))
    const response = NextResponse.json({
      status: result.status,
      account: result.account,
      message: result.message,
    })
    if (result.status === "success" && result.cookies) {
      writeSession(response, {
        cookies: result.cookies,
        account: result.account,
        updated_at: new Date().toISOString(),
      })
    }
    return response
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "登录轮询失败" },
      { status: error instanceof BilibiliError ? 409 : 500 },
    )
  }
}

import { NextRequest } from "next/server"
import { BilibiliError, startQrLogin } from "@/lib/server/bilibili"
import { jsonResponse, optionsResponse, rejectDisallowedOrigin } from "@/lib/cors"

export const runtime = "nodejs"

export async function OPTIONS(request: NextRequest) {
  return optionsResponse(request)
}

export async function POST(request: NextRequest) {
  const originError = rejectDisallowedOrigin(request)
  if (originError) return originError
  try {
    return jsonResponse(request, await startQrLogin())
  } catch (error) {
    return jsonResponse(
      request,
      { error: error instanceof Error ? error.message : "生成二维码失败" },
      { status: error instanceof BilibiliError ? 409 : 500 },
    )
  }
}

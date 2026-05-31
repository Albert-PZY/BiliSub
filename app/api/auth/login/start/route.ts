import { NextResponse } from "next/server"
import { BilibiliError, startQrLogin } from "@/lib/server/bilibili"

export const runtime = "nodejs"

export async function POST() {
  try {
    return NextResponse.json(await startQrLogin())
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "生成二维码失败" },
      { status: error instanceof BilibiliError ? 409 : 500 },
    )
  }
}

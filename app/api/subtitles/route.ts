import { NextRequest, NextResponse } from "next/server"
import { BilibiliError, fetchAiSubtitles } from "@/lib/server/bilibili"
import { readSession } from "@/lib/server/session"

export const runtime = "nodejs"

type SubtitlesPayload = {
  sources?: unknown[]
  language?: string
}

export async function POST(request: NextRequest) {
  const session = await readSession()
  if (!session?.cookies || Object.keys(session.cookies).length === 0) {
    return NextResponse.json({ error: "当前没有可用的 B 站登录态，请先扫码登录" }, { status: 401 })
  }

  const payload = (await request.json().catch(() => ({}))) as SubtitlesPayload
  const sources = (payload.sources ?? []).map((item) => String(item).trim()).filter(Boolean)
  const language = String(payload.language ?? "all").trim()
  const preferredLanguage = ["", "all", "__all__"].includes(language.toLowerCase()) ? null : language
  if (sources.length === 0) {
    return NextResponse.json({ items: [] })
  }

  const items = []
  for (const source of sources) {
    try {
      const subtitles = await fetchAiSubtitles(source, session.cookies, preferredLanguage)
      items.push({
        ok: true,
        source,
        subtitles: subtitles.map((subtitle) => ({
          language: subtitle.language,
          label: subtitle.label,
          text: subtitle.text,
          srt: subtitle.srt,
          raw_json: subtitle.raw_json,
        })),
      })
    } catch (error) {
      items.push({
        ok: false,
        source,
        error: error instanceof Error ? error.message : "获取字幕失败",
      })
      if (error instanceof BilibiliError && /登录态已失效/.test(error.message)) {
        break
      }
    }
  }

  return NextResponse.json({ items })
}

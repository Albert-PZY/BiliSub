import { NextRequest } from "next/server"
import { resolveVideo } from "@/lib/server/bilibili"
import { jsonResponse, optionsResponse, rejectDisallowedOrigin } from "@/lib/cors"
import { readSession } from "@/lib/server/session"
import { exceedsArrayLimit, mapWithConcurrency, MAX_VIDEO_SOURCES, normalizeStringList } from "@/lib/server/request"

export const runtime = "nodejs"

type ResolveVideosPayload = { sources?: unknown[] }

export async function OPTIONS(request: NextRequest) {
  return optionsResponse(request)
}

export async function POST(request: NextRequest) {
  const originError = rejectDisallowedOrigin(request)
  if (originError) return originError
  const session = await readSession(request)
  if (!session?.cookies || Object.keys(session.cookies).length === 0) {
    return jsonResponse(request, { error: "当前没有可用的 B 站登录态，请先扫码登录" }, { status: 401 })
  }

  const payload = (await request.json().catch(() => ({}))) as ResolveVideosPayload
  if (exceedsArrayLimit(payload.sources, MAX_VIDEO_SOURCES)) {
    return jsonResponse(request, { error: `单次最多解析 ${MAX_VIDEO_SOURCES} 个视频` }, { status: 400 })
  }

  const sources = normalizeStringList(payload.sources, MAX_VIDEO_SOURCES)
  if (sources.length === 0) return jsonResponse(request, { items: [] })

  const items = await mapWithConcurrency(sources, 4, async (source) => {
    try {
      const video = await resolveVideo(source)
      return { ok: true, source: video.source, bvid: video.bvid, aid: video.aid, title: video.title, pages: video.pages }
    } catch (error) {
      return { ok: false, source, error: error instanceof Error ? error.message : "解析视频失败" }
    }
  })

  return jsonResponse(request, { items })
}

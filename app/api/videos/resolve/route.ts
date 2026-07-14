import { NextRequest, NextResponse } from "next/server"
import { resolveVideo } from "@/lib/server/bilibili"
import { exceedsArrayLimit, mapWithConcurrency, MAX_VIDEO_SOURCES, normalizeStringList } from "@/lib/server/request"

export const runtime = "nodejs"

type ResolveVideosPayload = {
  sources?: unknown[]
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => ({}))) as ResolveVideosPayload
  if (exceedsArrayLimit(payload.sources, MAX_VIDEO_SOURCES)) {
    return NextResponse.json({ error: `单次最多解析 ${MAX_VIDEO_SOURCES} 个视频` }, { status: 400 })
  }

  const sources = normalizeStringList(payload.sources, MAX_VIDEO_SOURCES)

  if (sources.length === 0) {
    return NextResponse.json({ items: [] })
  }

  const items = await mapWithConcurrency(sources, 4, async (source) => {
    try {
      const video = await resolveVideo(source)
      return {
        ok: true,
        source: video.source,
        bvid: video.bvid,
        aid: video.aid,
        title: video.title,
        pages: video.pages,
      }
    } catch (error) {
      return {
        ok: false,
        source,
        error: error instanceof Error ? error.message : "解析视频失败",
      }
    }
  })

  return NextResponse.json({ items })
}

import { NextRequest, NextResponse } from "next/server"
import { resolveVideo } from "@/lib/server/bilibili"

export const runtime = "nodejs"

type ResolveVideosPayload = {
  sources?: unknown[]
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => ({}))) as ResolveVideosPayload
  const sources = (payload.sources ?? []).map((item) => String(item).trim()).filter(Boolean)

  if (sources.length === 0) {
    return NextResponse.json({ items: [] })
  }

  const items = await Promise.all(
    sources.map(async (source) => {
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
    }),
  )

  return NextResponse.json({ items })
}

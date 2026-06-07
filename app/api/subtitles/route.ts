import { NextRequest, NextResponse } from "next/server"
import {
  BilibiliError,
  fetchAiSubtitlesForPage,
  resolveVideo,
  type ResolvedVideoPage,
} from "@/lib/server/bilibili"
import { readSession } from "@/lib/server/session"

export const runtime = "nodejs"

type SubtitlesPayload = {
  pages?: unknown[]
  sources?: unknown[]
  language?: string
}

type SubtitleStreamEvent =
  | { type: "item"; item: SubtitleResponseItem }
  | { type: "error"; item: SubtitleResponseItem }
  | { type: "done" }

type SubtitleResponseItem = {
  ok: boolean
  source: string
  bvid?: string
  aid?: string
  cid?: string
  page?: number
  title?: string
  part?: string
  subtitles?: {
    language: string
    label: string
    text: string
    srt: string
    raw_json: string
  }[]
  error?: string
}

export async function POST(request: NextRequest) {
  const session = await readSession()
  if (!session?.cookies || Object.keys(session.cookies).length === 0) {
    return NextResponse.json({ error: "当前没有可用的 B 站登录态，请先扫码登录" }, { status: 401 })
  }

  const payload = (await request.json().catch(() => ({}))) as SubtitlesPayload
  const language = String(payload.language ?? "all").trim()
  const preferredLanguage = ["", "all", "__all__"].includes(language.toLowerCase()) ? null : language
  const pages = await resolveRequestedPages(payload)

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (event: SubtitleStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      }

      try {
        for (const page of pages) {
          try {
            const item = await fetchAiSubtitlesForPage(page, session.cookies, preferredLanguage)
            send({
              type: "item",
              item: {
                ok: true,
                source: item.source,
                bvid: item.bvid,
                aid: item.aid,
                cid: item.cid,
                page: item.page,
                title: item.title,
                part: item.part,
                subtitles: item.subtitles.map((subtitle) => ({
                  language: subtitle.language,
                  label: subtitle.label,
                  text: subtitle.text,
                  srt: subtitle.srt,
                  raw_json: subtitle.raw_json,
                })),
              },
            })
          } catch (error) {
            send({
              type: "error",
              item: {
                ok: false,
                source: page.source,
                bvid: page.bvid,
                aid: page.aid,
                cid: page.cid,
                page: page.page,
                title: page.title,
                part: page.part,
                error: error instanceof Error ? error.message : "获取字幕失败",
              },
            })

            if (error instanceof BilibiliError && /登录态已失效/.test(error.message)) {
              break
            }
          }
        }
      } finally {
        send({ type: "done" })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "application/x-ndjson; charset=utf-8",
    },
  })
}

async function resolveRequestedPages(payload: SubtitlesPayload): Promise<ResolvedVideoPage[]> {
  const pages = (payload.pages ?? []).flatMap(parseResolvedVideoPage)
  if (pages.length > 0) return pages

  const sources = (payload.sources ?? []).map((item) => String(item).trim()).filter(Boolean)
  const resolved: ResolvedVideoPage[] = []
  for (const source of sources) {
    const video = await resolveVideo(source)
    resolved.push(...video.pages)
  }
  return resolved
}

function parseResolvedVideoPage(item: unknown): ResolvedVideoPage[] {
  if (!item || typeof item !== "object") return []
  const row = item as Record<string, unknown>
  const source = String(row.source ?? "").trim()
  const bvid = String(row.bvid ?? "").trim()
  const aid = String(row.aid ?? "").trim()
  const cid = String(row.cid ?? "").trim()
  const page = Number(row.page ?? 0)
  const title = String(row.title ?? bvid).trim() || bvid
  const part = String(row.part ?? `P${page || 1}`).trim() || `P${page || 1}`
  if (!source || !bvid || !aid || !cid || !Number.isInteger(page) || page <= 0) return []
  return [{ source, bvid, aid, cid, page, title, part }]
}

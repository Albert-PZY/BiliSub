import { NextRequest } from "next/server"
import {
  BilibiliError,
  fetchAiSubtitlesForPage,
  resolveVideo,
  type ResolvedVideoPage,
} from "@/lib/server/bilibili"
import { readSession } from "@/lib/server/session"
import { jsonResponse, optionsResponse, rejectDisallowedOrigin, withCors } from "@/lib/cors"
import {
  exceedsArrayLimit,
  MAX_SUBTITLE_PAGES,
  MAX_VIDEO_SOURCES,
  normalizeStringList,
} from "@/lib/server/request"

export const runtime = "nodejs"

type SubtitlesPayload = {
  pages?: unknown[]
  sources?: unknown[]
  language?: string
}

type SubtitleStreamEvent =
  | { type: "item"; item: SubtitleResponseItem }
  | { type: "error"; item: SubtitleResponseItem }
  | { type: "auth-expired"; message: string }
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
  subtitles?: { language: string; label: string; text: string; srt: string; raw_json: string }[]
  error?: string
}

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

  const payload = (await request.json().catch(() => ({}))) as SubtitlesPayload
  if (exceedsArrayLimit(payload.pages, MAX_SUBTITLE_PAGES) || exceedsArrayLimit(payload.sources, MAX_VIDEO_SOURCES)) {
    return jsonResponse(request, { error: "请求中的视频或分 P 数量超过限制" }, { status: 400 })
  }
  const language = String(payload.language ?? "all").trim().slice(0, 32)
  const preferredLanguage = ["", "all", "__all__"].includes(language.toLowerCase()) ? null : language
  let pages: ResolvedVideoPage[]
  try {
    pages = await resolveRequestedPages(payload)
  } catch (error) {
    return jsonResponse(
      request,
      { error: error instanceof Error ? error.message : "解析字幕请求失败" },
      { status: error instanceof BilibiliError ? 422 : 500 },
    )
  }
  if (pages.length === 0) return jsonResponse(request, { error: "没有可获取字幕的视频分 P" }, { status: 400 })

  let upstreamController: AbortController | null = null
  let cancelled = false
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (event: SubtitleStreamEvent) => {
        if (cancelled || controller.desiredSize === null) return false
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
        return true
      }
      try {
        for (const page of pages) {
          if (cancelled) break
          const pageController = new AbortController()
          upstreamController = pageController
          try {
            const item = await fetchAiSubtitlesForPage(page, session.cookies, preferredLanguage, pageController.signal)
            if (!send({
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
            })) break
          } catch (error) {
            if (cancelled || pageController.signal.aborted) break
            const message = error instanceof Error ? error.message : "获取字幕失败"
            if (!send({
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
                error: message,
              },
            })) break
            if (error instanceof BilibiliError && /登录态已失效/.test(message)) {
              send({ type: "auth-expired", message: "Bilibili 登录态已失效，请重新扫码登录" })
              break
            }
          }
        }
      } finally {
        upstreamController?.abort()
        upstreamController = null
        if (!cancelled && controller.desiredSize !== null) {
          send({ type: "done" })
          controller.close()
        }
      }
    },
    cancel() {
      cancelled = true
      upstreamController?.abort()
    },
  })

  return withCors(
    request,
    new Response(stream, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        "Content-Type": "application/x-ndjson; charset=utf-8",
      },
    }),
  )
}

async function resolveRequestedPages(payload: SubtitlesPayload): Promise<ResolvedVideoPage[]> {
  const pages = (payload.pages ?? []).flatMap(parseResolvedVideoPage)
  const uniquePages = uniqueBy(pages, (page) => `${page.bvid}:${page.cid}`).slice(0, MAX_SUBTITLE_PAGES)
  if (uniquePages.length > 0) return uniquePages

  const sources = normalizeStringList(payload.sources, MAX_VIDEO_SOURCES)
  const resolved: ResolvedVideoPage[] = []
  for (const source of sources) {
    const video = await resolveVideo(source)
    resolved.push(...video.pages)
  }
  return uniqueBy(resolved, (page) => `${page.bvid}:${page.cid}`).slice(0, MAX_SUBTITLE_PAGES)
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
  if (!source || !/^BV[0-9A-Za-z]{10}$/.test(bvid) || !/^\d+$/.test(aid) || !/^\d+$/.test(cid) || !Number.isInteger(page) || page <= 0) return []
  return [{ source: source.slice(0, 2_000), bvid: bvid.slice(0, 32), aid: aid.slice(0, 32), cid: cid.slice(0, 32), page, title: title.slice(0, 300), part: part.slice(0, 300) }]
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = getKey(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

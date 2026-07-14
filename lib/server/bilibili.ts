import QRCode from "qrcode"
import type { Account } from "@/lib/server/session"

export type QrLoginSession = {
  qrcode_key: string
  qr_svg_url: string
  poll_interval_ms: number
}

export type QrPollStatus = "pending" | "scanned" | "confirmed" | "success" | "expired" | "failed"

export type QrPollResult = {
  status: QrPollStatus
  account: Account | null
  message: string
  cookies?: Record<string, string>
}

export type ResolvedSubtitle = {
  language: string
  label: string
  text: string
  srt: string
  raw_json: string
  subtitle_url: string
}

export type ResolvedVideoPage = {
  source: string
  bvid: string
  aid: string
  cid: string
  page: number
  title: string
  part: string
}

export type ResolvedVideo = {
  source: string
  bvid: string
  aid: string
  title: string
  pages: ResolvedVideoPage[]
}

export type ResolvedSubtitlePage = ResolvedVideoPage & {
  subtitles: ResolvedSubtitle[]
}

type SubtitleTrack = {
  language: string
  label: string
  subtitle_url: string
}

type VideoPage = {
  cid: string
  page: number
  part: string
}

type SubtitleSegment = {
  start: number
  end: number
  text: string
}

const COOKIE_WHITELIST = ["SESSDATA", "bili_jct", "DedeUserID", "DedeUserID__ckMd5", "sid"]
const BV_PATTERN = /\b(BV[0-9A-Za-z]{10})\b/
const VIDEO_PATH_PATTERN = /\/video\/(BV[0-9A-Za-z]{10})/
const SHORT_LINK_HOSTS = new Set(["b23.tv", "www.b23.tv"])
const AUTH_EXPIRED_PATTERN = /未登录|登录态.{0,8}失效|SESSDATA/i
const DEFAULT_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  Origin: "https://www.bilibili.com",
  Referer: "https://www.bilibili.com/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
}

export class BilibiliError extends Error {}

export async function startQrLogin(): Promise<QrLoginSession> {
  const payload = await requestJson(
    "https://passport.bilibili.com/x/passport-login/web/qrcode/generate?source=main-fe-header",
  )
  const data = asRecord(payload.data)
  const qrcodeKey = String(data.qrcode_key ?? "").trim()
  const qrcodeUrl = String(data.url ?? "").trim()
  if (!qrcodeKey || !qrcodeUrl) {
    throw new BilibiliError("生成 B 站扫码登录会话失败")
  }

  const svg = await QRCode.toString(qrcodeUrl, {
    type: "svg",
    margin: 1,
  })

  return {
    qrcode_key: qrcodeKey,
    qr_svg_url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    poll_interval_ms: 1500,
  }
}

export async function pollQrLogin(qrcodeKey: string): Promise<QrPollResult> {
  if (!qrcodeKey.trim()) {
    throw new BilibiliError("qrcode_key 不能为空")
  }

  const response = await fetchBilibili(
    `https://passport.bilibili.com/x/passport-login/web/qrcode/poll?${new URLSearchParams({
      qrcode_key: qrcodeKey.trim(),
      source: "main-fe-header",
    })}`,
    {
      headers: DEFAULT_HEADERS,
      cache: "no-store",
    },
  )
  const payload = await parseJsonResponse(response)
  const data = asRecord(payload.data)
  const pollCode = Number(data.code ?? payload.code ?? -1)
  const message = String(data.message ?? payload.message ?? "").trim() || "unknown"

  if (pollCode === 0) {
    const cookies = extractResponseCookies(response)
    if (Object.keys(cookies).length === 0) {
      throw new BilibiliError("扫码成功，但没有拿到有效登录 Cookie")
    }
    const account = await fetchAccountSummary(cookies)
    return {
      status: "success",
      account,
      message: message === "0" ? "登录成功" : message,
      cookies,
    }
  }

  if (pollCode === 86038) {
    return {
      status: "expired",
      account: null,
      message: message || "二维码已失效",
    }
  }

  return {
    status: mapQrPollStatus(pollCode),
    account: null,
    message,
  }
}

export async function fetchAccountSummary(cookies: Record<string, string>): Promise<Account> {
  const response = await fetchBilibili("https://api.bilibili.com/x/web-interface/nav", {
    headers: buildRequestHeaders(buildCookieHeader(cookies)),
    cache: "no-store",
  })
  const payload = await parseJsonResponse(response)
  if (looksLikeExpiredAuth(response.status, payload)) {
    throw new BilibiliError("当前登录态已失效")
  }
  assertSuccessfulApiResponse(response, payload, "读取 B 站账号信息失败")
  const data = asRecord(payload.data)
  const mid = String(data.mid ?? "").trim()
  const uname = String(data.uname ?? "").trim()
  if (!mid || !uname) {
    throw new BilibiliError("B 站账号信息不完整，请重新扫码登录")
  }
  return { mid, uname }
}

export async function fetchAiSubtitles(
  sourceInput: string,
  cookies: Record<string, string>,
  preferredLanguage?: string | null,
): Promise<ResolvedSubtitlePage[]> {
  const video = await resolveVideo(sourceInput)
  const items: ResolvedSubtitlePage[] = []

  for (const page of video.pages) {
    items.push(await fetchAiSubtitlesForPage(page, cookies, preferredLanguage))
  }

  return items
}

export async function resolveVideo(sourceInput: string): Promise<ResolvedVideo> {
  const bvid = extractBvid(sourceInput) ?? await resolveShortLinkBvid(sourceInput)
  if (!bvid) {
    throw new BilibiliError("无法从输入中解析 BV 号")
  }

  const viewPayload = await requestJson(
    `https://api.bilibili.com/x/web-interface/view?${new URLSearchParams({ bvid })}`,
  )
  const viewData = asRecord(viewPayload.data)
  const aid = String(viewData.aid ?? "").trim()
  const title = String(viewData.title ?? bvid).trim() || bvid
  const pages = resolveVideoPages(viewData).map((page) => ({
    source: sourceInput,
    bvid,
    aid,
    cid: page.cid,
    page: page.page,
    title,
    part: page.part,
  }))
  if (!aid || pages.length === 0) {
    throw new BilibiliError("未能解析视频 aid/cid")
  }

  return {
    source: sourceInput,
    bvid,
    aid,
    title,
    pages,
  }
}

export async function fetchAiSubtitlesForPage(
  page: ResolvedVideoPage,
  cookies: Record<string, string>,
  preferredLanguage?: string | null,
): Promise<ResolvedSubtitlePage> {
  const cookieHeader = buildCookieHeader(cookies)
  const subtitles = await fetchPageAiSubtitles(page.aid, page.cid, cookieHeader, preferredLanguage)
  return {
    ...page,
    subtitles,
  }
}

async function fetchPageAiSubtitles(
  aid: string,
  cid: string,
  cookieHeader: string,
  preferredLanguage?: string | null,
): Promise<ResolvedSubtitle[]> {
  const playerResponse = await fetchBilibili(
    `https://api.bilibili.com/x/player/wbi/v2?${new URLSearchParams({ aid, cid })}`,
    {
      headers: buildRequestHeaders(cookieHeader),
      cache: "no-store",
    },
  )
  const playerPayload = await parseJsonResponse(playerResponse)
  if (looksLikeExpiredAuth(playerResponse.status, playerPayload)) {
    throw new BilibiliError("Bilibili 登录态已失效，请重新扫码登录")
  }
  assertSuccessfulApiResponse(playerResponse, playerPayload, "读取字幕列表失败")

  const subtitleData = asRecord(asRecord(playerPayload.data).subtitle)
  const rawTracks = Array.isArray(subtitleData.subtitles) ? subtitleData.subtitles : []
  const tracks = selectSubtitleTracks(rawTracks, preferredLanguage)
  if (tracks.length === 0) {
    return []
  }

  const results = await Promise.allSettled(tracks.map(async (track): Promise<ResolvedSubtitle | null> => {
    const subtitleResponse = await fetchBilibili(track.subtitle_url, {
      headers: buildRequestHeaders(cookieHeader),
      cache: "no-store",
    })
    const rawJson = await subtitleResponse.text()
    let subtitlePayload: Record<string, unknown> | null = null
    try {
      subtitlePayload = JSON.parse(rawJson) as Record<string, unknown>
    } catch {
      subtitlePayload = null
    }
    if (looksLikeExpiredAuth(subtitleResponse.status, subtitlePayload)) {
      throw new BilibiliError("Bilibili 登录态已失效，请重新扫码登录")
    }
    if (!subtitleResponse.ok) {
      throw new BilibiliError(`下载${track.label || track.language}字幕失败（HTTP ${subtitleResponse.status}）`)
    }

    const segments = parseSubtitleSegments(rawJson)
    if (segments.length === 0) return null
    return {
      language: track.language,
      label: track.label || track.language,
      raw_json: rawJson,
      srt: renderSrt(segments),
      subtitle_url: track.subtitle_url,
      text: buildTranscriptText(segments),
    }
  }))

  const authError = results.find(
    (result): result is PromiseRejectedResult =>
      result.status === "rejected" &&
      result.reason instanceof BilibiliError &&
      AUTH_EXPIRED_PATTERN.test(result.reason.message),
  )
  if (authError) throw authError.reason

  const subtitles = results.flatMap((result) =>
    result.status === "fulfilled" && result.value ? [result.value] : [],
  )
  if (subtitles.length === 0) {
    const firstError = results.find((result): result is PromiseRejectedResult => result.status === "rejected")
    if (firstError) {
      throw firstError.reason instanceof Error ? firstError.reason : new BilibiliError("下载字幕失败")
    }
  }

  return subtitles
}

function extractBvid(sourceInput: string): string | null {
  const raw = String(sourceInput || "").trim()
  if (!raw) return null
  const directMatch = BV_PATTERN.exec(raw)
  if (directMatch) return directMatch[1]
  try {
    const parsed = new URL(raw)
    const pathMatch = VIDEO_PATH_PATTERN.exec(parsed.pathname)
    return pathMatch?.[1] ?? null
  } catch {
    return null
  }
}

async function resolveShortLinkBvid(sourceInput: string): Promise<string | null> {
  let url: URL
  try {
    url = new URL(String(sourceInput ?? "").trim())
  } catch {
    return null
  }
  if (!SHORT_LINK_HOSTS.has(url.hostname.toLowerCase())) return null

  const response = await fetchBilibili(url.toString(), {
    headers: DEFAULT_HEADERS,
    cache: "no-store",
    redirect: "follow",
  })
  const bvid = extractBvid(response.url)
  await response.body?.cancel()
  return bvid
}

function resolveVideoPages(viewData: Record<string, unknown>): VideoPage[] {
  const pages = Array.isArray(viewData.pages) ? viewData.pages : []
  const resolvedPages = pages.flatMap((item, index) => {
    const row = asRecord(item)
    const cid = String(row.cid ?? "").trim()
    if (!cid) return []
    const page = normalizePositiveInteger(row.page, index + 1)
    const part = String(row.part ?? row.title ?? `P${page}`).trim() || `P${page}`
    return [{ cid, page, part }]
  })

  if (resolvedPages.length > 0) {
    return resolvedPages.sort((a, b) => a.page - b.page)
  }

  const cid = String(viewData.cid ?? "").trim()
  return cid ? [{ cid, page: 1, part: "P1" }] : []
}

function selectSubtitleTracks(payload: unknown[], preferredLanguage?: string | null): SubtitleTrack[] {
  const tracks = payload.flatMap((item) => {
    const raw = asRecord(item)
    const language = normalizeLanguage(raw.lan ?? raw.lang)
    const subtitleUrl = normalizeSubtitleUrl(raw.subtitle_url)
    if (!language || !subtitleUrl) return []
    return [
      {
        language,
        label: String(raw.lan_doc ?? raw.lan ?? raw.lang ?? "").trim(),
        subtitle_url: subtitleUrl,
      },
    ]
  })

  const uniqueTracks = [...new Map(tracks.map((track) => [`${track.language}:${track.subtitle_url}`, track])).values()]
  const sortedTracks = uniqueTracks.sort((a, b) => {
    const rankDiff = rankLanguage(a.language, preferredLanguage) - rankLanguage(b.language, preferredLanguage)
    return rankDiff || a.language.localeCompare(b.language)
  })
  if (!preferredLanguage || normalizeLanguage(preferredLanguage) === "all") {
    return sortedTracks
  }
  const preferred = normalizeLanguage(preferredLanguage)
  const exactTracks = sortedTracks.filter((track) => track.language === preferred)
  if (exactTracks.length > 0) return exactTracks
  return sortedTracks.filter((track) => baseLanguage(track.language) === baseLanguage(preferred))
}

function parseSubtitleSegments(rawJson: string): SubtitleSegment[] {
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawJson) as Record<string, unknown>
  } catch {
    return []
  }

  if (Array.isArray(payload.body)) {
    return payload.body.flatMap((item) => {
      const row = asRecord(item)
      const text = normalizeText(row.content)
      if (!text) return []
      return [
        {
          start: roundMs(Number(row.from ?? 0)),
          end: roundMs(Number(row.to ?? 0)),
          text,
        },
      ]
    })
  }

  const events = Array.isArray(payload.events) ? payload.events : []
  return events.flatMap((event) => {
    const row = asRecord(event)
    const segs = Array.isArray(row.segs) ? row.segs : []
    const text = normalizeText(segs.map((segment) => String(asRecord(segment).utf8 ?? "")).join(""))
    if (!text) return []
    const start = roundMs(Number(row.tStartMs ?? 0) / 1000)
    const duration = Math.max(0, Number(row.dDurationMs ?? 0) / 1000)
    return [{ start, end: roundMs(start + duration), text }]
  })
}

function renderSrt(segments: SubtitleSegment[]): string {
  return segments
    .map((segment, index) => [String(index + 1), `${formatSrtTimestamp(segment.start)} --> ${formatSrtTimestamp(segment.end)}`, segment.text].join("\n"))
    .join("\n\n")
}

async function requestJson(url: string): Promise<Record<string, unknown>> {
  const response = await fetchBilibili(url, {
    headers: DEFAULT_HEADERS,
    cache: "no-store",
  })
  const payload = await parseJsonResponse(response)
  assertSuccessfulApiResponse(response, payload, "B 站接口请求失败")
  return payload
}

async function parseJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text()
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new BilibiliError(`B 站接口返回了无法解析的响应（HTTP ${response.status}）`)
  }
}

async function fetchBilibili(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(20_000),
    })
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new BilibiliError("B 站接口请求超时，请稍后重试")
    }
    throw new BilibiliError("暂时无法连接 B 站接口，请稍后重试")
  }
}

function assertSuccessfulApiResponse(
  response: Response,
  payload: Record<string, unknown>,
  fallbackMessage: string,
): void {
  const code = Number(payload.code ?? 0)
  if (response.ok && code === 0) return
  const message = String(payload.message ?? payload.msg ?? "").trim()
  throw new BilibiliError(message ? `${fallbackMessage}：${message}` : `${fallbackMessage}（HTTP ${response.status}）`)
}

function buildRequestHeaders(cookieHeader: string): Record<string, string> {
  return cookieHeader ? { ...DEFAULT_HEADERS, Cookie: cookieHeader } : DEFAULT_HEADERS
}

function buildCookieHeader(cookies: Record<string, string>): string {
  return COOKIE_WHITELIST.flatMap((name) => {
    const value = String(cookies[name] ?? "").trim()
    return value ? [`${name}=${value}`] : []
  }).join("; ")
}

function extractResponseCookies(response: Response): Record<string, string> {
  const setCookies = getSetCookie(response.headers)
  const cookies: Record<string, string> = {}
  for (const cookieString of setCookies) {
    const pair = cookieString.split(";", 1)[0]
    const equalsIndex = pair.indexOf("=")
    if (equalsIndex <= 0) continue
    const name = pair.slice(0, equalsIndex).trim()
    const value = pair.slice(equalsIndex + 1).trim()
    if (COOKIE_WHITELIST.includes(name) && value) {
      cookies[name] = value
    }
  }
  return cookies
}

function getSetCookie(headers: Headers): string[] {
  const extended = headers as Headers & { getSetCookie?: () => string[] }
  const direct = extended.getSetCookie?.()
  if (direct?.length) return direct
  const combined = headers.get("set-cookie")
  if (!combined) return []
  return combined.split(/,(?=\s*[^;,]+=)/g).map((value) => value.trim())
}

function normalizeSubtitleUrl(rawUrl: unknown): string {
  const value = String(rawUrl ?? "").trim()
  if (value.startsWith("//")) return `https:${value}`
  return value
}

function normalizeLanguage(value: unknown): string {
  return String(value ?? "").trim().toLowerCase()
}

function baseLanguage(value: unknown): string {
  return normalizeLanguage(value).split("-", 1)[0].split("_", 1)[0]
}

function rankLanguage(value: string, preferredLanguage?: string | null): number {
  const preferred = normalizeLanguage(preferredLanguage)
  const normalized = normalizeLanguage(value)
  if (!preferred || preferred === "all") return 0
  if (normalized === preferred) return 0
  if (baseLanguage(normalized) === baseLanguage(preferred)) return 1
  return 2
}

function looksLikeExpiredAuth(statusCode: number, payload: Record<string, unknown> | null): boolean {
  if (statusCode === 401) return true
  if (!payload) return false
  const code = Number(payload.code ?? 0)
  const message = String(payload.message ?? payload.msg ?? "").trim()
  return code === -101 || AUTH_EXPIRED_PATTERN.test(message)
}

function buildTranscriptText(segments: SubtitleSegment[]): string {
  return segments.map((segment) => segment.text).filter(Boolean).join("\n").trim()
}

function normalizeText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim()
}

function formatSrtTimestamp(seconds: number): string {
  const whole = Math.max(0, seconds)
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const secs = Math.floor(whole % 60)
  let millis = Math.round((whole - Math.floor(whole)) * 1000)
  let normalizedSecs = secs
  if (millis === 1000) {
    normalizedSecs += 1
    millis = 0
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(normalizedSecs)},${String(millis).padStart(3, "0")}`
}

function mapQrPollStatus(code: number): QrPollStatus {
  if (code === 86101) return "pending"
  if (code === 86090) return "scanned"
  if (code === 86100) return "confirmed"
  return "failed"
}

function roundMs(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 1000) / 1000
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  const number = Number(value)
  if (Number.isInteger(number) && number > 0) return number
  return fallback
}

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

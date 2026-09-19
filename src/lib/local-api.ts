export type Account = {
  mid: string
  uname: string
}

export type VideoSource = {
  id: string
  url: string
}

export type SubtitleLanguageMode = "all" | "zh-Hans" | "zh-Hant" | "en" | "ja" | "ko"

export type SessionStatus = {
  status: "missing" | "active" | "expired"
  account: Account | null
  last_error?: string | null
  session_token?: string
}

export type LoginSession = {
  qrcode_key: string
  qr_svg_url: string
  poll_interval_ms: number
}

export type LoginPollResult = {
  status: "pending" | "scanned" | "confirmed" | "success" | "expired" | "failed"
  account: Account | null
  message: string
  session_token?: string
}

export type SubtitleVariantResult = {
  language: string
  label: string
  text: string
  srt: string
  raw_json: string
}

export type SubtitleResult = {
  ok: boolean
  source: string
  bvid?: string
  aid?: string
  cid?: string
  page?: number
  title?: string
  part?: string
  subtitles?: SubtitleVariantResult[]
  error?: string
}

export type ResolvedVideoPageResult = {
  source: string
  bvid: string
  aid: string
  cid: string
  page: number
  title: string
  part: string
}

export type ResolvedVideoResult = {
  ok: boolean
  source: string
  bvid?: string
  aid?: string
  title?: string
  pages?: ResolvedVideoPageResult[]
  error?: string
}

export type SubtitleStreamEvent =
  | { type: "item"; item: SubtitleResult }
  | { type: "error"; item: SubtitleResult }
  | { type: "auth-expired"; message: string }
  | { type: "done" }
type RequestOptions = {
  signal?: AbortSignal
}

const SESSION_TOKEN_KEY = "biliaisub.session"

export function buildVideoPageId(page: Pick<ResolvedVideoPageResult, "bvid" | "cid">): string {
  return `${page.bvid}:${page.cid}`
}

export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "")
  if (configured) return configured
  // 留空时，本地开发使用 Vite 的 /api 代理，其他同源部署直接请求当前来源。
  // 静态生产站点必须在构建时提供 VITE_API_BASE_URL。
  return ""
}

export function clearSessionToken(): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.removeItem(SESSION_TOKEN_KEY)
  } catch {
    // 浏览器禁用存储时无需额外处理。
  }
}

export async function postJson<T>(path: string, payload: unknown = {}, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    method: "POST",
    headers: buildHeaders(false),
    body: JSON.stringify(payload),
    credentials: "include",
    signal: options.signal,
  })
  const text = await response.text()
  const data = parseJson(text)
  if (!response.ok) {
    if (response.status === 401) clearSessionToken()
    throw new ApiError(readErrorMessage(data, text, response.status), response.status)
  }
  captureSessionToken(data)
  if (data === null) return undefined as T
  return data as T
}

export async function streamPostJson<TEvent>(
  path: string,
  payload: unknown,
  onEvent: (event: TEvent) => void,
  options: RequestOptions = {},
): Promise<void> {
  const response = await fetch(buildApiUrl(path), {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify(payload),
    credentials: "include",
    signal: options.signal,
  })
  if (!response.ok) {
    const text = await response.text()
    if (response.status === 401) clearSessionToken()
    throw new ApiError(readErrorMessage(parseJson(text), text, response.status), response.status)
  }
  if (!response.body) throw new Error("当前浏览器不支持流式读取响应")

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed) onEvent(parseStreamEvent<TEvent>(trimmed))
    }
  }
  buffer += decoder.decode()
  const trimmed = buffer.trim()
  if (trimmed) onEvent(parseStreamEvent<TEvent>(trimmed))
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = "ApiError"
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError"
}

function buildApiUrl(path: string): string {
  const base = getApiBaseUrl()
  return `${base}${path.startsWith("/") ? path : `/${path}`}`
}

function buildHeaders(stream: boolean): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (stream) headers.Accept = "application/x-ndjson"
  const token = readSessionToken()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

function readSessionToken(): string {
  if (typeof window === "undefined") return ""
  try {
    return window.sessionStorage.getItem(SESSION_TOKEN_KEY) ?? ""
  } catch {
    return ""
  }
}

function captureSessionToken(data: unknown): void {
  if (typeof window === "undefined" || !data || typeof data !== "object" || !("session_token" in data)) return
  const token = String((data as { session_token?: unknown }).session_token ?? "")
  if (!token) return
  try {
    window.sessionStorage.setItem(SESSION_TOKEN_KEY, token)
  } catch {
    // 无法持久化时仍保留本次请求的 Cookie 会话。
  }
}

function parseJson(text: string): unknown {
  if (!text.trim()) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function readErrorMessage(data: unknown, rawText: string, status: number): string {
  if (data && typeof data === "object" && "error" in data) {
    const error = String((data as { error?: unknown }).error ?? "").trim()
    if (error) return error
  }
  return rawText.trim() || `请求失败：${status}`
}

function parseStreamEvent<TEvent>(line: string): TEvent {
  try {
    return JSON.parse(line) as TEvent
  } catch {
    throw new Error("服务端返回了无法解析的流式数据")
  }
}

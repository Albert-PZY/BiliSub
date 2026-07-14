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
  | { type: "done" }

type RequestOptions = {
  signal?: AbortSignal
}

export function buildVideoPageId(page: Pick<ResolvedVideoPageResult, "bvid" | "cid">): string {
  return `${page.bvid}:${page.cid}`
}

export async function postJson<T>(path: string, payload: unknown = {}, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: options.signal,
  })
  const text = await response.text()
  const data = parseJson(text)
  if (!response.ok) {
    throw new ApiError(readErrorMessage(data, text, response.status), response.status)
  }
  if (data === null) return undefined as T
  return data as T
}

export async function streamPostJson<TEvent>(
  path: string,
  payload: unknown,
  onEvent: (event: TEvent) => void,
  options: RequestOptions = {},
): Promise<void> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      Accept: "application/x-ndjson",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: options.signal,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new ApiError(readErrorMessage(parseJson(text), text, response.status), response.status)
  }

  if (!response.body) {
    throw new Error("当前浏览器不支持流式读取响应")
  }

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
      if (!trimmed) continue
      onEvent(parseStreamEvent<TEvent>(trimmed))
    }
  }

  buffer += decoder.decode()
  const trimmed = buffer.trim()
  if (trimmed) {
    onEvent(parseStreamEvent<TEvent>(trimmed))
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError"
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

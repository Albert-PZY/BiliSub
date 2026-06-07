export type Account = {
  mid: string
  uname: string
}

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

export function buildVideoPageId(page: Pick<ResolvedVideoPageResult, "bvid" | "cid">): string {
  return `${page.bvid}:${page.cid}`
}

export async function postJson<T>(path: string, payload: unknown = {}): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || `请求失败：${response.status}`)
  }
  return data as T
}

export async function streamPostJson<TEvent>(
  path: string,
  payload: unknown,
  onEvent: (event: TEvent) => void,
): Promise<void> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      Accept: "application/x-ndjson",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    let message = text || `请求失败：${response.status}`
    try {
      const data = JSON.parse(text) as { error?: string }
      message = data.error || message
    } catch {
      // Keep the raw response text as the error message.
    }
    throw new Error(message)
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
      onEvent(JSON.parse(trimmed) as TEvent)
    }
  }

  buffer += decoder.decode()
  const trimmed = buffer.trim()
  if (trimmed) {
    onEvent(JSON.parse(trimmed) as TEvent)
  }
}

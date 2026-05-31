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
  subtitles?: SubtitleVariantResult[]
  error?: string
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

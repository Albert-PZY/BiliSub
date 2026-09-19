import { NextRequest, NextResponse } from "next/server"

const DEFAULT_ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "http://localhost:4173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:4173",
  "https://albert-pzy.github.io",
])

export function withCors<T extends Response>(request: NextRequest, response: T): T {
  const origin = request.headers.get("origin")
  if (!origin || !isAllowedOrigin(origin)) return response

  response.headers.set("Access-Control-Allow-Origin", origin)
  response.headers.set("Access-Control-Allow-Credentials", "true")
  response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type")
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS")
  response.headers.set("Access-Control-Max-Age", "86400")
  response.headers.set("Vary", "Origin")
  return response
}

export function jsonResponse(request: NextRequest, body: unknown, init?: ResponseInit): NextResponse {
  return withCors(request, NextResponse.json(body, init))
}

export function optionsResponse(request: NextRequest): NextResponse {
  const origin = request.headers.get("origin")
  if (origin && !isAllowedOrigin(origin) && !isSameOriginRequest(request)) return new NextResponse(null, { status: 403 })
  return withCors(request, new NextResponse(null, { status: 204 }))
}
export function rejectDisallowedOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin")
  return origin && !isAllowedOrigin(origin) && !isSameOriginRequest(request)
    ? NextResponse.json({ error: "不允许的请求来源" }, { status: 403 })
    : null
}
function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin")
  const requestOrigin = getRequestOrigin(request)
  const normalizedOrigin = origin ? normalizeOrigin(origin) : ""
  return Boolean(normalizedOrigin && requestOrigin && normalizedOrigin === requestOrigin)
}


/** 只有可信的异源前端需要拿到 Bearer 令牌；同源请求继续只使用 HttpOnly Cookie。 */
export function sessionTokenPayload(request: NextRequest, token?: string | null): { session_token?: string } {
  return token && isCrossOriginRequest(request) ? { session_token: token } : {}
}

function isCrossOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin")
  if (!origin || !isAllowedOrigin(origin)) return false

  const normalizedOrigin = normalizeOrigin(origin)
  const requestOrigin = getRequestOrigin(request)
  return Boolean(normalizedOrigin && requestOrigin && normalizedOrigin !== requestOrigin)
}

function getRequestOrigin(request: NextRequest): string {
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim()
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim()
  const host = forwardedHost || request.headers.get("host")
  if (host) return normalizeOrigin(`${forwardedProtocol || request.nextUrl.protocol.replace(/:$/, "")}://${host}`)
  return normalizeOrigin(request.nextUrl.origin)
}

function normalizeOrigin(value: string): string {
  try {
    return new URL(value).origin
  } catch {
    return ""
  }
}

function isAllowedOrigin(origin: string): boolean {
  if (DEFAULT_ALLOWED_ORIGINS.has(origin)) return true
  const configured = (process.env.BILI_SUB_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
  return configured.includes(origin)
}

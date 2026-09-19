import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import { cookies } from "next/headers"
import type { NextRequest, NextResponse } from "next/server"

export type Account = {
  mid: string
  uname: string
}

export type StoredSession = {
  cookies: Record<string, string>
  account: Account | null
  updated_at: string
}

const COOKIE_NAME = "bili_ai_sub_session"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30
const SESSION_MAX_AGE_MS = COOKIE_MAX_AGE * 1_000

/** 优先读取跨域前端提交的加密 Bearer Token；同源部署继续使用 HttpOnly Cookie。 */
export async function readSession(request?: NextRequest): Promise<StoredSession | null> {
  const bearer = request?.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]
  const cookie = (await cookies()).get(COOKIE_NAME)?.value
  const candidates = [bearer, cookie].filter((value): value is string => Boolean(value))

  for (const sealed of candidates) {
    try {
      const session = unsealSession(sealed)
      if (!isSessionExpired(session)) return session
    } catch {
      // 尝试下一个会话来源；无效令牌不应遮挡仍然有效的 Cookie。
    }
  }
  return null
}

export function isSessionExpired(session: StoredSession, now = Date.now()): boolean {
  const updatedAt = Date.parse(session.updated_at)
  return !Number.isFinite(updatedAt) || now - updatedAt > SESSION_MAX_AGE_MS
}

export function createSessionToken(session: StoredSession): string {
  return sealSession(session)
}

export function writeSession(
  response: NextResponse,
  session: StoredSession,
  token = createSessionToken(session),
): void {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  })
}

export function clearSession(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
}

function sealSession(session: StoredSession): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString("base64url")
}

function unsealSession(value: string): StoredSession {
  const raw = Buffer.from(value, "base64url")
  if (raw.length <= 28) throw new Error("会话数据长度无效")
  const iv = raw.subarray(0, 12)
  const tag = raw.subarray(12, 28)
  const encrypted = raw.subarray(28)
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv)
  decipher.setAuthTag(tag)
  const json = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")
  const parsed = JSON.parse(json) as Partial<StoredSession>
  if (!parsed.cookies || typeof parsed.cookies !== "object" || !parsed.updated_at) {
    throw new Error("会话数据不完整")
  }
  return {
    cookies: parsed.cookies as Record<string, string>,
    account: parsed.account ?? null,
    updated_at: parsed.updated_at,
  }
}

function getKey(): Buffer {
  const secret =
    process.env.BILI_SUB_SESSION_SECRET ||
    process.env.SESSION_SECRET ||
    (process.env.NODE_ENV === "production" ? "" : "dev-only-bili-ai-sub-session-secret")
  if (!secret) throw new Error("缺少 BILI_SUB_SESSION_SECRET 环境变量")
  return createHash("sha256").update(secret).digest()
}

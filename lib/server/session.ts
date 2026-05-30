import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import { cookies } from "next/headers"
import type { NextResponse } from "next/server"

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

export async function readSession(): Promise<StoredSession | null> {
  const store = await cookies()
  const sealed = store.get(COOKIE_NAME)?.value
  if (!sealed) return null
  try {
    return unsealSession(sealed)
  } catch {
    return null
  }
}

export function writeSession(response: NextResponse, session: StoredSession): void {
  response.cookies.set(COOKIE_NAME, sealSession(session), {
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
  const iv = raw.subarray(0, 12)
  const tag = raw.subarray(12, 28)
  const encrypted = raw.subarray(28)
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv)
  decipher.setAuthTag(tag)
  const json = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")
  const parsed = JSON.parse(json) as StoredSession
  return {
    cookies: parsed.cookies ?? {},
    account: parsed.account ?? null,
    updated_at: parsed.updated_at ?? new Date().toISOString(),
  }
}

function getKey(): Buffer {
  const secret =
    process.env.BILI_SUB_SESSION_SECRET ||
    process.env.SESSION_SECRET ||
    (process.env.NODE_ENV === "production" ? "" : "dev-only-bili-ai-sub-session-secret")
  if (!secret) {
    throw new Error("缺少 BILI_SUB_SESSION_SECRET 环境变量")
  }
  return createHash("sha256").update(secret).digest()
}

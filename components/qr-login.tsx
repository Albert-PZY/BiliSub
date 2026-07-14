"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CheckCircle2, LogOut, QrCode, RefreshCw, ShieldCheck, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  isAbortError,
  postJson,
  type Account,
  type LoginPollResult,
  type LoginSession,
  type SessionStatus,
} from "@/lib/local-api"

type LoginStatus = "idle" | "checking" | "loading" | "scanning" | "confirming" | "success" | "expired" | "failed"

export function QrLogin({
  onLoginSuccess,
  onLogout,
}: {
  onLoginSuccess?: (user: Account) => void
  onLogout?: () => void
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollControllerRef = useRef<AbortController | null>(null)
  const requestControllerRef = useRef<AbortController | null>(null)
  const onLoginSuccessRef = useRef(onLoginSuccess)
  const onLogoutRef = useRef(onLogout)
  const [status, setStatus] = useState<LoginStatus>("checking")
  const [qrUrl, setQrUrl] = useState("")
  const [message, setMessage] = useState("正在检查本机登录态")
  const [user, setUser] = useState<Account | null>(null)

  onLoginSuccessRef.current = onLoginSuccess
  onLogoutRef.current = onLogout

  const stopPolling = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    pollControllerRef.current?.abort()
    pollControllerRef.current = null
  }, [])

  const cancelRequest = useCallback(() => {
    requestControllerRef.current?.abort()
    requestControllerRef.current = null
  }, [])

  const setLoggedIn = useCallback((account: Account, nextMessage: string) => {
    setUser(account)
    setStatus("success")
    setMessage(nextMessage)
    onLoginSuccessRef.current?.(account)
  }, [])

  const refreshStatus = useCallback(async () => {
    cancelRequest()
    const controller = new AbortController()
    requestControllerRef.current = controller
    setStatus("checking")
    setMessage("正在检查本机登录态")

    try {
      const snapshot = await postJson<SessionStatus>("/api/auth/status", {}, { signal: controller.signal })
      if (snapshot.status === "active" && snapshot.account) {
        setLoggedIn(snapshot.account, "登录态可用，仅保存在当前设备")
      } else {
        setUser(null)
        setStatus(snapshot.status === "expired" ? "expired" : "idle")
        setMessage(snapshot.last_error || "扫码后即可开始获取字幕")
      }
    } catch (error) {
      if (isAbortError(error)) return
      setStatus("failed")
      setMessage(error instanceof Error ? error.message : "检查登录态失败")
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null
    }
  }, [cancelRequest, setLoggedIn])

  useEffect(() => {
    void refreshStatus()
    return () => {
      stopPolling()
      cancelRequest()
    }
  }, [cancelRequest, refreshStatus, stopPolling])

  const pollLogin = useCallback(
    (session: LoginSession) => {
      stopPolling()
      const controller = new AbortController()
      const interval = Math.max(800, session.poll_interval_ms || 1500)
      pollControllerRef.current = controller

      const poll = async () => {
        try {
          const result = await postJson<LoginPollResult>(
            "/api/auth/login/poll",
            { qrcode_key: session.qrcode_key },
            { signal: controller.signal },
          )
          if (result.status === "success" && result.account) {
            stopPolling()
            setLoggedIn(result.account, "登录成功，可以开始添加视频")
            return
          }
          if (result.status === "scanned" || result.status === "confirmed") {
            setStatus("confirming")
            setMessage("已扫码，请在手机上确认登录")
          } else if (result.status === "expired" || result.status === "failed") {
            stopPolling()
            setStatus(result.status)
            setMessage(result.message || "二维码已失效，请重新获取")
            return
          } else {
            setStatus("scanning")
            setMessage("等待 B 站 App 扫码")
          }
          timerRef.current = setTimeout(poll, interval)
        } catch (error) {
          if (isAbortError(error)) return
          stopPolling()
          setStatus("failed")
          setMessage(error instanceof Error ? error.message : "登录轮询失败")
        }
      }

      timerRef.current = setTimeout(poll, interval)
    },
    [setLoggedIn, stopPolling],
  )

  const generateQrCode = useCallback(async () => {
    stopPolling()
    cancelRequest()
    const controller = new AbortController()
    requestControllerRef.current = controller
    setStatus("loading")
    setMessage("正在生成安全登录二维码")

    try {
      const session = await postJson<LoginSession>("/api/auth/login/start", {}, { signal: controller.signal })
      setQrUrl(session.qr_svg_url)
      setStatus("scanning")
      setMessage("请使用 B 站 App 扫码登录")
      pollLogin(session)
    } catch (error) {
      if (isAbortError(error)) return
      setStatus("failed")
      setMessage(error instanceof Error ? error.message : "生成二维码失败")
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null
    }
  }, [cancelRequest, pollLogin, stopPolling])

  const handleLogout = async () => {
    stopPolling()
    cancelRequest()
    const controller = new AbortController()
    requestControllerRef.current = controller
    try {
      await postJson("/api/auth/logout", {}, { signal: controller.signal })
      setUser(null)
      setQrUrl("")
      setStatus("idle")
      setMessage("已清除本机登录态")
      onLogoutRef.current?.()
    } catch (error) {
      if (isAbortError(error)) return
      setStatus("failed")
      setMessage(error instanceof Error ? error.message : "退出登录失败")
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null
    }
  }

  if (user && status === "success") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/70 p-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-4 w-4" />
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{user.uname}</p>
              <p className="text-xs text-muted-foreground">UID {user.mid}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
            <LogOut className="h-4 w-4" />
            退出
          </Button>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          {message}
        </p>
      </div>
    )
  }

  const showQrCode = status === "scanning" || status === "confirming"
  const isLoading = status === "checking" || status === "loading"

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-background/50 p-5">
      {(isLoading || showQrCode) && (
        <div className="relative grid h-44 w-44 place-items-center overflow-hidden rounded-2xl border border-border bg-white p-3 shadow-sm">
          {isLoading ? (
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          ) : (
            <img src={qrUrl} alt="B站扫码登录二维码" className="h-full w-full" />
          )}
          {status === "confirming" && (
            <div className="absolute inset-0 grid place-items-center bg-white/90">
              <div className="flex flex-col items-center gap-2 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
                <span className="text-xs font-medium">等待确认</span>
              </div>
            </div>
          )}
        </div>
      )}

      {!isLoading && !showQrCode && (
        <div className="grid h-24 w-24 place-items-center rounded-3xl bg-primary/10 text-primary">
          <QrCode className="h-9 w-9" />
        </div>
      )}

      <div className="space-y-3 text-center">
        <p className="text-sm text-muted-foreground" aria-live="polite">{message}</p>
        {showQrCode ? (
          <Button variant="ghost" size="sm" onClick={generateQrCode}>
            <RefreshCw className="h-3.5 w-3.5" />
            刷新二维码
          </Button>
        ) : !isLoading ? (
          <Button onClick={generateQrCode}>
            <QrCode className="h-4 w-4" />
            获取登录二维码
          </Button>
        ) : null}
      </div>
    </div>
  )
}

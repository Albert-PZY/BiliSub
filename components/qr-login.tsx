'use client'

import { useCallback, useEffect, useRef, useState } from "react"
import { CheckCircle2, LogOut, QrCode, RefreshCw, ShieldCheck, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  clearSessionToken,
  isAbortError,
  postJson,
  type Account,
  type LoginPollResult,
  type LoginSession,
  type SessionStatus,
} from "@/lib/local-api"

type LoginStatus = "idle" | "checking" | "loading" | "scanning" | "confirming" | "success" | "expired" | "failed"

export type AuthStatus = SessionStatus["status"] | "checking"

function toSessionStatus(status: LoginStatus): AuthStatus {
  if (status === "success") return "active"
  if (status === "expired") return "expired"
  if (status === "checking") return "checking"
  return "missing"
}

export function QrLogin({
  authExpiredKey = 0,
  onStatusChange,
  onLogout,
}: {
  authExpiredKey?: number
  onStatusChange?: (status: AuthStatus, account: Account | null) => void
  onLogout?: () => void
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollControllerRef = useRef<AbortController | null>(null)
  const requestControllerRef = useRef<AbortController | null>(null)
  const onStatusChangeRef = useRef(onStatusChange)
  const onLogoutRef = useRef(onLogout)
  const [status, setStatus] = useState<LoginStatus>("checking")
  const [qrUrl, setQrUrl] = useState("")
  const [message, setMessage] = useState("正在检查本机登录态")
  const [user, setUser] = useState<Account | null>(null)

  onStatusChangeRef.current = onStatusChange
  onLogoutRef.current = onLogout

  const report = useCallback((nextStatus: LoginStatus, account: Account | null) => {
    onStatusChangeRef.current?.(toSessionStatus(nextStatus), account)
  }, [])

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
    report("success", account)
  }, [report])

  const refreshStatus = useCallback(async () => {
    cancelRequest()
    const controller = new AbortController()
    requestControllerRef.current = controller
    setStatus("checking")
    setMessage("正在检查本机登录态")
    report("checking", null)

    try {
      const snapshot = await postJson<SessionStatus>("/api/auth/status", {}, { signal: controller.signal })
      if (snapshot.status === "active" && snapshot.account) {
        setLoggedIn(snapshot.account, "登录态可用，仅保存在当前设备")
      } else {
        clearSessionToken()
        const next: LoginStatus = snapshot.status === "expired" ? "expired" : "idle"
        setUser(null)
        setStatus(next)
        setMessage(snapshot.last_error || "扫码后即可开始获取字幕")
        report(next, null)
      }
    } catch (error) {
      if (isAbortError(error)) return
      setStatus("failed")
      setMessage(error instanceof Error ? error.message : "检查登录态失败")
      report("failed", null)
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null
    }
  }, [cancelRequest, report, setLoggedIn])

  useEffect(() => {
    void refreshStatus()
    return () => {
      stopPolling()
      cancelRequest()
    }
  }, [cancelRequest, refreshStatus, stopPolling])

  useEffect(() => {
    if (authExpiredKey === 0) return
    stopPolling()
    cancelRequest()
    setUser(null)
    setQrUrl("")
    setStatus("expired")
    setMessage("Bilibili 登录态已失效，请重新扫码登录")
    report("expired", null)
  }, [authExpiredKey, cancelRequest, report, stopPolling])

  const pollLogin = useCallback((session: LoginSession) => {
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
          report("confirming", null)
        } else if (result.status === "expired" || result.status === "failed") {
          stopPolling()
          setStatus(result.status)
          setMessage(result.message || "二维码已失效，请重新获取")
          report(result.status, null)
          return
        } else {
          setStatus("scanning")
          setMessage("等待 B 站 App 扫码")
          report("scanning", null)
        }
        timerRef.current = setTimeout(poll, interval)
      } catch (error) {
        if (isAbortError(error)) return
        stopPolling()
        setStatus("failed")
        setMessage(error instanceof Error ? error.message : "登录轮询失败")
        report("failed", null)
      }
    }

    timerRef.current = setTimeout(poll, interval)
  }, [report, setLoggedIn, stopPolling])

  const generateQrCode = useCallback(async () => {
    stopPolling()
    cancelRequest()
    const controller = new AbortController()
    requestControllerRef.current = controller
    setStatus("loading")
    setMessage("正在生成安全登录二维码")
    report("loading", null)

    try {
      const session = await postJson<LoginSession>("/api/auth/login/start", {}, { signal: controller.signal })
      setQrUrl(session.qr_svg_url)
      setStatus("scanning")
      setMessage("请使用 B 站 App 扫码登录")
      report("scanning", null)
      pollLogin(session)
    } catch (error) {
      if (isAbortError(error)) return
      setStatus("failed")
      setMessage(error instanceof Error ? error.message : "生成二维码失败")
      report("failed", null)
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null
    }
  }, [cancelRequest, pollLogin, report, stopPolling])

  const handleLogout = async () => {
    stopPolling()
    cancelRequest()
    const controller = new AbortController()
    requestControllerRef.current = controller
    try {
      await postJson("/api/auth/logout", {}, { signal: controller.signal })
      clearSessionToken()
      setUser(null)
      setQrUrl("")
      setStatus("idle")
      setMessage("已清除本机登录态")
      report("idle", null)
      onLogoutRef.current?.()
    } catch (error) {
      if (isAbortError(error)) return
      setStatus("failed")
      setMessage(error instanceof Error ? error.message : "退出登录失败")
      report("failed", null)
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null
    }
  }

  if (user && status === "success") {
    return (
      <div>
        <div className="account-row">
          <div className="account-identity">
            <div className="account-avatar"><User size={17} aria-hidden="true" /></div>
            <div>
              <p className="account-name" title={user.uname}>{user.uname}</p>
              <p className="account-meta">UID {user.mid}</p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut size={14} aria-hidden="true" />退出
          </Button>
        </div>
        <p className="security-note"><ShieldCheck size={14} aria-hidden="true" />{message}</p>
      </div>
    )
  }

  const showQrCode = status === "scanning" || status === "confirming"
  const isLoading = status === "checking" || status === "loading"

  return (
    <div className="login-box">
      {(isLoading || showQrCode) && (
        <div className="qr-frame">
          {isLoading ? <RefreshCw size={22} className="spin" aria-label="加载中" /> : <img src={qrUrl} alt="B 站扫码登录二维码" />}
          {status === "confirming" && (
            <div className="qr-overlay">
              <div>
                <CheckCircle2 size={28} aria-hidden="true" />
                <span className="sr-only">等待确认</span>
              </div>
            </div>
          )}
        </div>
      )}

      {!isLoading && !showQrCode && (
        <div className="login-box__visual"><QrCode size={34} aria-hidden="true" /></div>
      )}

      <p className="login-message" aria-live="polite">{message}</p>
      {showQrCode ? (
        <Button type="button" variant="ghost" size="sm" onClick={generateQrCode}>
          <RefreshCw size={14} aria-hidden="true" />刷新二维码
        </Button>
      ) : !isLoading ? (
        <Button type="button" onClick={generateQrCode}>
          <QrCode size={16} aria-hidden="true" />获取登录二维码
        </Button>
      ) : null}
    </div>
  )
}

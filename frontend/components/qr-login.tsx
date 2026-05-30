"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CheckCircle2, LogOut, QrCode, RefreshCw, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { postJson, type Account, type LoginPollResult, type LoginSession, type SessionStatus } from "@/lib/local-api"

type LoginStatus = "idle" | "checking" | "loading" | "scanning" | "confirming" | "success" | "expired" | "failed"

export function QrLogin({
  onLoginSuccess,
  onLogout,
}: {
  onLoginSuccess?: (user: Account) => void
  onLogout?: () => void
}) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [status, setStatus] = useState<LoginStatus>("checking")
  const [qrUrl, setQrUrl] = useState("")
  const [message, setMessage] = useState("正在检查本地登录态")
  const [user, setUser] = useState<Account | null>(null)

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const refreshStatus = useCallback(async () => {
    setStatus("checking")
    try {
      const snapshot = await postJson<SessionStatus>("/local/status")
      if (snapshot.status === "active" && snapshot.account) {
        setUser(snapshot.account)
        setStatus("success")
        setMessage("已使用本机登录态")
        onLoginSuccess?.(snapshot.account)
      } else {
        setUser(null)
        setStatus(snapshot.status === "expired" ? "expired" : "idle")
        setMessage(snapshot.last_error || "请先扫码登录 B 站")
      }
    } catch (error) {
      setStatus("failed")
      setMessage(error instanceof Error ? error.message : "检查登录态失败")
    }
  }, [onLoginSuccess])

  useEffect(() => {
    refreshStatus()
    return stopPolling
  }, [refreshStatus, stopPolling])

  const pollLogin = useCallback(
    (session: LoginSession) => {
      stopPolling()
      timerRef.current = setInterval(async () => {
        try {
          const result = await postJson<LoginPollResult>("/local/login/poll", {
            qrcode_key: session.qrcode_key,
          })
          if (result.status === "success" && result.account) {
            stopPolling()
            setUser(result.account)
            setStatus("success")
            setMessage("登录成功")
            onLoginSuccess?.(result.account)
            return
          }
          if (result.status === "scanned" || result.status === "confirmed") {
            setStatus("confirming")
            setMessage("已扫码，请在手机上确认")
            return
          }
          if (result.status === "expired" || result.status === "failed") {
            stopPolling()
            setStatus(result.status)
            setMessage(result.message || "二维码已失效")
            return
          }
          setStatus("scanning")
          setMessage("等待扫码")
        } catch (error) {
          stopPolling()
          setStatus("failed")
          setMessage(error instanceof Error ? error.message : "登录轮询失败")
        }
      }, Math.max(800, session.poll_interval_ms || 1500))
    },
    [onLoginSuccess, stopPolling],
  )

  const generateQrCode = useCallback(async () => {
    stopPolling()
    setStatus("loading")
    setMessage("正在生成二维码")
    try {
      const session = await postJson<LoginSession>("/local/login/start")
      setQrUrl(`${session.qr_svg_url}?t=${Date.now()}`)
      setStatus("scanning")
      setMessage("请使用 B 站 App 扫码登录")
      pollLogin(session)
    } catch (error) {
      setStatus("failed")
      setMessage(error instanceof Error ? error.message : "生成二维码失败")
    }
  }, [pollLogin, stopPolling])

  const handleLogout = async () => {
    stopPolling()
    await postJson("/local/logout")
    setUser(null)
    setQrUrl("")
    setStatus("idle")
    setMessage("已清除本机登录态")
    onLogout?.()
  }

  if (user && status === "success") {
    return (
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center overflow-hidden">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-foreground truncate">{user.uname}</span>
            <span className="text-xs text-muted-foreground">UID: {user.mid}</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {(status === "idle" || status === "expired" || status === "failed") && (
        <Button onClick={generateQrCode} variant="outline" className="gap-2">
          <QrCode className="h-4 w-4" />
          获取登录二维码
        </Button>
      )}

      {status === "checking" || status === "loading" ? (
        <div className="h-40 w-40 rounded-lg bg-muted/50 flex items-center justify-center">
          <RefreshCw className="h-6 w-6 text-muted-foreground animate-spin" />
        </div>
      ) : null}

      {(status === "scanning" || status === "confirming") && (
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-40 w-40 rounded-lg bg-white p-2">
              <img src={qrUrl} alt="B站扫码登录二维码" className="h-full w-full" />
            </div>
            {status === "confirming" && (
              <div className="absolute inset-0 bg-background/80 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-accent" />
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={generateQrCode} className="text-xs">
            <RefreshCw className="h-3 w-3 mr-1" />
            刷新二维码
          </Button>
        </div>
      )}

      <p className="text-sm text-muted-foreground text-center">{message}</p>
    </div>
  )
}

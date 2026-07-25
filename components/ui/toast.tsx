"use client"

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react"
import { CheckCircle2, Info, X, XCircle } from "lucide-react"

type ToastTone = "success" | "error" | "info"

interface ToastItem {
  id: number
  tone: ToastTone
  message: string
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

/**
 * 极简 Toast 层（无第三方依赖）：右下角堆叠，3s 自动消失。
 * 取代散落在各组件中的行内错误文案，统一获取/解析/下载等操作反馈。
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: number) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const toast = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = (idRef.current += 1)
      setToasts((previous) => [...previous, { id, tone, message }])
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), 3200),
      )
    },
    [dismiss],
  )

  const value = useMemo<ToastContextValue>(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2"
        aria-live="polite"
        role="status"
      >
        {toasts.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  return (
    <div
      className={`pointer-events-auto flex max-w-xs items-start gap-2.5 rounded-xl border bg-card/95 px-3.5 py-3 text-xs shadow-[0_18px_50px_-28px_rgba(15,23,42,0.55)] backdrop-blur animate-in fade-in slide-in-from-bottom-2 ${
        item.tone === "success"
          ? "border-emerald-500/25"
          : item.tone === "error"
            ? "border-destructive/30"
            : "border-border"
      }`}
    >
      <span className="mt-0.5 shrink-0">
        {item.tone === "success" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
        {item.tone === "error" && <XCircle className="h-4 w-4 text-destructive" />}
        {item.tone === "info" && <Info className="h-4 w-4 text-primary" />}
      </span>
      <p className="flex-1 leading-5 text-foreground">{item.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="-mr-1 -mt-1 shrink-0 rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        aria-label="关闭提示"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast 必须在 ToastProvider 内使用")
  }
  return context
}

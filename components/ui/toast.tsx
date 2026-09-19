'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { CheckCircle2, Info, X, XCircle } from "lucide-react"

type ToastTone = "success" | "error" | "info"

type ToastItem = {
  id: number
  tone: ToastTone
  message: string
}

type ToastContextValue = {
  toast: (message: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)
  const timers = useRef<Map<number, number>>(new Map())

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      window.clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  useEffect(() => () => {
    for (const timer of timers.current.values()) window.clearTimeout(timer)
    timers.current.clear()
  }, [])

  const toast = useCallback((message: string, tone: ToastTone = "info") => {
    const id = idRef.current + 1
    idRef.current = id
    setToasts((current) => [...current, { id, tone, message }])
    timers.current.set(id, window.setTimeout(() => dismiss(id), 3200))
  }, [dismiss])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite" role="status">
        {toasts.map((item) => <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />)}
      </div>
    </ToastContext.Provider>
  )
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const Icon = item.tone === "success" ? CheckCircle2 : item.tone === "error" ? XCircle : Info
  return (
    <div className={`toast-card toast-card--${item.tone}`}>
      <Icon size={16} aria-hidden="true" />
      <p className="toast-card__message">{item.message}</p>
      <button type="button" className="icon-button toast-card__close" onClick={onDismiss} aria-label="关闭提示">
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error("useToast 必须在 ToastProvider 内使用")
  return context
}

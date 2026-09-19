import { AlertTriangle, CheckCircle2, FileText, Loader2, XCircle } from "lucide-react"
import type { SubtitleItem } from "@/lib/subtitles"

export type { SubtitleItem, SubtitleVariant } from "@/lib/subtitles"

export function SubtitleList({
  items,
  selectedId,
  onSelect,
}: {
  items: SubtitleItem[]
  selectedId?: string
  onSelect?: (item: SubtitleItem) => void
}) {
  if (items.length === 0) return <p className="empty-copy">暂无字幕数据</p>

  return (
    <div className="task-list">
      {items.map((item) => {
        const resolveError = item.kind === "resolve-error"
        const selected = selectedId === item.id
        const interactive = item.status === "success"
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => interactive && onSelect?.(item)}
            disabled={!interactive}
            aria-pressed={interactive ? selected : undefined}
            className={`task-row${selected ? " task-row--selected" : ""}${resolveError ? " task-row--muted" : ""}`}
          >
            <span className={`task-row__icon ${statusIconClass(item.status, resolveError)}`}>
              {statusIcon(item.status, resolveError)}
            </span>
            <span className="task-row__body">
              <span className="task-row__title" title={item.title}>{item.title}</span>
              <span className="task-row__meta" title={item.error || statusText(item, resolveError)}>
                {statusText(item, resolveError)}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function statusIcon(status: SubtitleItem["status"], resolveError: boolean) {
  if (status === "loading") return <Loader2 size={15} className="spin" aria-hidden="true" />
  if (status === "success") return <CheckCircle2 size={15} aria-hidden="true" />
  if (status === "error" && resolveError) return <AlertTriangle size={15} aria-hidden="true" />
  if (status === "error") return <XCircle size={15} aria-hidden="true" />
  return <FileText size={15} aria-hidden="true" />
}

function statusIconClass(status: SubtitleItem["status"], resolveError: boolean): string {
  if (status === "success") return "task-row__icon--success"
  if (status === "error" && resolveError) return "task-row__icon--warning"
  if (status === "error") return "task-row__icon--danger"
  return ""
}

function statusText(item: SubtitleItem, resolveError: boolean): string {
  if (item.status === "loading") return "正在获取字幕…"
  if (item.status === "success") return `${item.subtitles?.length ?? 0} 种语言 · 选择后编辑`
  if (item.status === "error" && resolveError) return `视频解析失败 · ${item.error || "解析失败"}`
  if (item.status === "error") return item.error || "获取失败"
  return "没有可用的 AI 字幕"
}

"use client"

import { CheckCircle2, FileText, Loader2, XCircle } from "lucide-react"
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
  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        暂无字幕数据
      </div>
    )
  }

  return (
    <div className="max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => item.status === "success" && onSelect?.(item)}
          disabled={item.status !== "success"}
          aria-pressed={item.status === "success" ? selectedId === item.id : undefined}
          className={`group w-full rounded-xl border px-3 py-3 text-left transition ${
            selectedId === item.id
              ? "border-primary/30 bg-primary/8 shadow-sm"
              : "border-transparent bg-muted/40 hover:border-border hover:bg-muted/70"
          } ${item.status !== "success" ? "cursor-default opacity-65" : "cursor-pointer"}`}
        >
          <div className="flex items-start gap-2">
            <div className="mt-0.5 shrink-0">
              {item.status === "loading" && (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              )}
              {item.status === "success" && (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              )}
              {item.status === "error" && (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              {item.status === "no-subtitle" && (
                <FileText className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground" title={item.title}>{item.title}</p>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {item.status === "loading" && "正在获取字幕…"}
                {item.status === "success" && (
                  <>
                    <span>{item.subtitles?.length ?? 0} 种语言</span>
                    <span aria-hidden="true">·</span>
                    <span>点击编辑</span>
                  </>
                )}
                {item.status === "error" && (
                  <span className="truncate text-destructive" title={item.error || "获取失败"}>{item.error || "获取失败"}</span>
                )}
                {item.status === "no-subtitle" && "没有可用的 AI 字幕"}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

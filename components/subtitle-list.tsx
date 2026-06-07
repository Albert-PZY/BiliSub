"use client"

import { CheckCircle2, XCircle, Loader2, FileText } from "lucide-react"

export interface SubtitleVariant {
  language: string
  label: string
  content: string
  srt?: string
  rawJson?: string
}

export interface SubtitleItem {
  id: string
  bvid: string
  cid?: string
  page?: number
  part?: string
  title: string
  status: "loading" | "success" | "error" | "no-subtitle"
  subtitles?: SubtitleVariant[]
  error?: string
}

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
    <div className="space-y-1">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => item.status === "success" && onSelect?.(item)}
          disabled={item.status !== "success"}
          className={`w-full text-left px-3 py-2.5 rounded-md transition-colors group ${
            selectedId === item.id
              ? "bg-accent/10 border border-accent/30"
              : "hover:bg-muted/50"
          } ${item.status !== "success" ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <div className="flex items-start gap-2">
            <div className="mt-0.5 flex-shrink-0">
              {item.status === "loading" && (
                <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
              )}
              {item.status === "success" && (
                <CheckCircle2 className="h-4 w-4 text-accent" />
              )}
              {item.status === "error" && (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              {item.status === "no-subtitle" && (
                <FileText className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {item.status === "loading" && "正在获取..."}
                {item.status === "success" && `${item.subtitles?.length ?? 0} 种语言，点击编辑`}
                {item.status === "error" && (item.error || "获取失败")}
                {item.status === "no-subtitle" && "无AI字幕"}
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

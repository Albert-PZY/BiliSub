"use client"

import { CheckSquare, CircleAlert, ListChecks, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { buildVideoPageId, type ResolvedVideoPageResult, type ResolvedVideoResult } from "@/lib/local-api"

export function VideoPageSelector({
  videos,
  selectedIds,
  disabled,
  onTogglePage,
  onSelectAll,
  onClear,
  onSubmit,
}: {
  videos: ResolvedVideoResult[]
  selectedIds: Set<string>
  disabled?: boolean
  onTogglePage: (page: ResolvedVideoPageResult) => void
  onSelectAll: () => void
  onClear: () => void
  onSubmit: () => void
}) {
  const pages = videos.flatMap((video) => video.pages ?? [])
  const selectedCount = pages.filter((page) => selectedIds.has(buildVideoPageId(page))).length

  if (videos.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">选择分P</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            已选 {selectedCount}/{pages.length} 个分P
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onSelectAll} disabled={disabled || pages.length === 0}>
            全选
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClear} disabled={disabled || selectedCount === 0}>
            清空
          </Button>
        </div>
      </div>

      <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
        {videos.map((video) => {
          const videoPages = video.pages ?? []
          return (
            <div key={video.source} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-xs font-medium text-foreground">
                  {video.title || video.source}
                </p>
                {video.ok && (
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    {videoPages.length > 1 ? `${videoPages.length}P` : "单视频"}
                  </span>
                )}
              </div>

              {!video.ok ? (
                <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{video.error || "解析失败"}</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {videoPages.map((page) => {
                    const pageId = buildVideoPageId(page)
                    const checked = selectedIds.has(pageId)
                    return (
                      <button
                        key={pageId}
                        type="button"
                        onClick={() => onTogglePage(page)}
                        disabled={disabled}
                        className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                          checked ? "bg-accent/10 text-foreground" : "bg-muted/45 text-foreground/80 hover:bg-muted/70"
                        }`}
                      >
                        {checked ? (
                          <CheckSquare className="h-4 w-4 shrink-0 text-accent" />
                        ) : (
                          <Square className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          P{page.page}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{page.part || `P${page.page}`}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Button type="button" className="w-full" size="sm" onClick={onSubmit} disabled={disabled || selectedCount === 0}>
        <ListChecks className="h-4 w-4" />
        获取已选分P字幕
      </Button>
    </div>
  )
}

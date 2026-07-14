"use client"

import { useMemo, useState } from "react"
import { CheckSquare, CircleAlert, ListChecks, Search, Square } from "lucide-react"
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
  const [query, setQuery] = useState("")
  const pages = videos.flatMap((video) => video.pages ?? [])
  const selectedCount = pages.filter((page) => selectedIds.has(buildVideoPageId(page))).length
  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN")
  const visibleVideos = useMemo(
    () => videos.flatMap((video) => {
      if (!normalizedQuery) return [video]
      const videoMatches = `${video.title ?? ""} ${video.source}`.toLocaleLowerCase("zh-CN").includes(normalizedQuery)
      const filteredPages = (video.pages ?? []).filter((page) =>
        `${page.page} ${page.part}`.toLocaleLowerCase("zh-CN").includes(normalizedQuery),
      )
      return videoMatches || filteredPages.length > 0 ? [{ ...video, pages: videoMatches ? video.pages : filteredPages }] : []
    }),
    [normalizedQuery, videos],
  )

  if (videos.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">选择要处理的分 P</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            已选 {selectedCount}/{pages.length} 个分P
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-lg bg-muted/60 p-0.5">
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onSelectAll} disabled={disabled || pages.length === 0}>
            全选
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClear} disabled={disabled || selectedCount === 0}>
            清空
          </Button>
        </div>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: pages.length > 0 ? `${(selectedCount / pages.length) * 100}%` : "0%" }}
        />
      </div>

      {pages.length > 8 && (
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索视频或分 P"
            className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-xs outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
          />
        </label>
      )}

      <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
        {visibleVideos.map((video) => {
          const videoPages = video.pages ?? []
          return (
            <div key={video.source} className="space-y-2 rounded-xl border border-border/70 bg-background/60 p-2.5">
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
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => onTogglePage(page)}
                        disabled={disabled}
                        className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          checked ? "border-primary/20 bg-primary/8 text-foreground" : "border-transparent bg-muted/45 text-foreground/80 hover:bg-muted/70"
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

      {visibleVideos.length === 0 && (
        <p className="rounded-xl border border-dashed border-border py-6 text-center text-xs text-muted-foreground">没有匹配的分 P</p>
      )}

      <Button type="button" className="w-full" onClick={onSubmit} disabled={disabled || selectedCount === 0}>
        <ListChecks className="h-4 w-4" />
        获取已选分P字幕
      </Button>
    </div>
  )
}

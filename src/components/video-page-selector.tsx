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
  const selectableVideos = useMemo(
    () => videos.filter((video) => (video.pages?.length ?? 0) > 1),
    [videos],
  )
  const pages = selectableVideos.flatMap((video) => video.pages ?? [])
  const selectedCount = pages.filter((page) => selectedIds.has(buildVideoPageId(page))).length
  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN")
  const visibleVideos = useMemo(
    () => selectableVideos.flatMap((video) => {
      if (!normalizedQuery) return [video]
      const videoMatches = `${video.title ?? ""} ${video.source}`.toLocaleLowerCase("zh-CN").includes(normalizedQuery)
      const filteredPages = (video.pages ?? []).filter((page) => `${page.page} ${page.part}`.toLocaleLowerCase("zh-CN").includes(normalizedQuery))
      return videoMatches || filteredPages.length > 0 ? [{ ...video, pages: videoMatches ? video.pages : filteredPages }] : []
    }),
    [normalizedQuery, selectableVideos],
  )
  if (selectableVideos.length === 0) return null
  if (videos.length === 0) return null

  return (
    <div className="video-form">
      <div className="pending-list-head">
        <div>
          <p className="section-note">已选 {selectedCount}/{pages.length} 个分 P</p>
        </div>
        <div className="editor-tools__actions">
          <Button type="button" variant="ghost" size="sm" onClick={onSelectAll} disabled={disabled || pages.length === 0}>全选</Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={disabled || selectedCount === 0}>清空</Button>
        </div>
      </div>

      <div className="selector-progress" aria-hidden="true">
        <div className="selector-progress__bar" style={{ width: pages.length > 0 ? `${(selectedCount / pages.length) * 100}%` : "0%" }} />
      </div>

      {pages.length > 8 && (
        <label className="search-wrap">
          <span className="sr-only">搜索视频或分 P</span>
          <Search size={15} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索视频或分 P" className="search-input" />
        </label>
      )}

      <div className="page-list">
        {visibleVideos.map((video) => {
          const videoPages = video.pages ?? []
          return (
            <div key={video.source} className="selector-video">
              <div className="selector-video__head">
                <p className="selector-video__title" title={video.title || video.source}>{video.title || video.source}</p>
                {video.ok && <span className="selector-badge">{videoPages.length > 1 ? `${videoPages.length}P` : "单视频"}</span>}
              </div>

              {!video.ok ? (
                <div className="selector-error"><CircleAlert size={14} aria-hidden="true" /><span>{video.error || "解析失败"}</span></div>
              ) : (
                <div className="page-list">
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
                        className={`selector-page${checked ? " selector-page--selected" : ""}`}
                      >
                        {checked ? <CheckSquare size={15} aria-hidden="true" /> : <Square size={15} aria-hidden="true" />}
                        <span className="selector-page__number">P{page.page}</span>
                        {page.part && page.part !== `P${page.page}` && <span className="selector-page__label">{page.part}</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {visibleVideos.length === 0 && <p className="empty-copy">没有匹配的分 P</p>}

      <Button type="button" size="lg" onClick={onSubmit} disabled={disabled || selectedCount === 0}>
        <ListChecks size={16} aria-hidden="true" />获取已选分 P 字幕
      </Button>
    </div>
  )
}

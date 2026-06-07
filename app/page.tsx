"use client"

import { useState } from "react"
import { Github } from "lucide-react"
import { DownloadPanel } from "@/components/download-panel"
import { QrLogin } from "@/components/qr-login"
import { SubtitleEditor } from "@/components/subtitle-editor"
import { SubtitleItem, SubtitleList, type SubtitleVariant } from "@/components/subtitle-list"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { VideoInput, type SubtitleLanguageMode, type VideoSource } from "@/components/video-input"
import { VideoPageSelector } from "@/components/video-page-selector"
import {
  buildVideoPageId,
  postJson,
  streamPostJson,
  type ResolvedVideoPageResult,
  type ResolvedVideoResult,
  type SubtitleResult,
  type SubtitleStreamEvent,
} from "@/lib/local-api"

const GITHUB_REPOSITORY_URL = "https://github.com/Albert-PZY/BiliSub"

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([])
  const [selectedSubtitle, setSelectedSubtitle] = useState<SubtitleItem | null>(null)
  const [selectedLanguage, setSelectedLanguage] = useState("")
  const [editedContent, setEditedContent] = useState("")
  const [resolvedVideos, setResolvedVideos] = useState<ResolvedVideoResult[]>([])
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set())
  const [subtitleLanguage, setSubtitleLanguage] = useState<SubtitleLanguageMode>("all")
  const [isResolving, setIsResolving] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const selectedVariant = findVariant(selectedSubtitle, selectedLanguage)

  const handleLogout = () => {
    setIsLoggedIn(false)
    setSubtitles([])
    setResolvedVideos([])
    setSelectedPageIds(new Set())
    setSelectedSubtitle(null)
    setSelectedLanguage("")
    setEditedContent("")
  }

  const handleResolveVideos = async (videos: VideoSource[], language: SubtitleLanguageMode) => {
    setIsResolving(true)
    setSubtitleLanguage(language)
    setResolvedVideos([])
    setSelectedPageIds(new Set())
    setSubtitles([])
    setSelectedSubtitle(null)
    setSelectedLanguage("")
    setEditedContent("")

    let pagesToFetch: ResolvedVideoPageResult[] | null = null
    let initialItems: SubtitleItem[] = []

    try {
      const payload = await postJson<{ items: ResolvedVideoResult[] }>("/api/videos/resolve", {
        sources: videos.map((video) => video.url),
      })
      const items = payload.items
      const pages = items.flatMap((item) => item.pages ?? [])
      const resolveErrorItems = items.filter((item) => !item.ok).map(buildResolveErrorItem)
      const hasMultiPartVideo = items.some((item) => (item.pages?.length ?? 0) > 1)
      const defaultSelectedPages = hasMultiPartVideo
        ? items.flatMap((item) => ((item.pages?.length ?? 0) === 1 ? item.pages ?? [] : []))
        : pages

      if (hasMultiPartVideo) {
        setResolvedVideos(items)
        setSelectedPageIds(new Set(defaultSelectedPages.map(buildVideoPageId)))
      }

      if (!hasMultiPartVideo && pages.length > 0) {
        pagesToFetch = pages
        initialItems = resolveErrorItems
      }

      if (pages.length === 0) {
        setSubtitles(resolveErrorItems.length > 0 ? resolveErrorItems : items.map(buildResolveErrorItem))
      } else if (hasMultiPartVideo && resolveErrorItems.length > 0) {
        setSubtitles(resolveErrorItems)
      }
    } catch (error) {
      setSubtitles(videos.map((video, index) => buildRequestErrorItem(video.url, index, error)))
    } finally {
      setIsResolving(false)
    }

    if (pagesToFetch) {
      await fetchSubtitlesForPages(pagesToFetch, language, initialItems)
    }
  }

  const fetchSubtitlesForPages = async (
    pages: ResolvedVideoPageResult[],
    language: SubtitleLanguageMode,
    initialItems: SubtitleItem[] = [],
  ) => {
    const loadingItems = pages.map(buildLoadingItemFromPage)
    let hasSelectedFirstSuccess = false

    setIsFetching(true)
    setSubtitles([...initialItems, ...loadingItems])
    setSelectedSubtitle(null)
    setSelectedLanguage("")
    setEditedContent("")

    try {
      await streamPostJson<SubtitleStreamEvent>(
        "/api/subtitles",
        {
          pages,
          language,
        },
        (event) => {
          if (event.type === "done") return
          const nextItem = buildSubtitleItemFromResult(event.item)
          setSubtitles((prev) => upsertSubtitleItem(prev, nextItem))

          if (nextItem.status === "success" && !hasSelectedFirstSuccess) {
            hasSelectedFirstSuccess = true
            handleSelectSubtitle(nextItem)
          }
        },
      )
    } catch (error) {
      setSubtitles((prev) =>
        prev.map((item) =>
          item.status === "loading"
            ? {
                ...item,
                status: "error" as const,
                error: error instanceof Error ? error.message : "获取失败",
              }
            : item,
        ),
      )
    } finally {
      setIsFetching(false)
    }
  }

  const handleTogglePage = (page: ResolvedVideoPageResult) => {
    const pageId = buildVideoPageId(page)
    setSelectedPageIds((prev) => {
      const next = new Set(prev)
      if (next.has(pageId)) {
        next.delete(pageId)
      } else {
        next.add(pageId)
      }
      return next
    })
  }

  const handleSelectAllPages = () => {
    const pages = resolvedVideos.flatMap((video) => video.pages ?? [])
    setSelectedPageIds(new Set(pages.map(buildVideoPageId)))
  }

  const handleClearSelectedPages = () => {
    setSelectedPageIds(new Set())
  }

  const handleFetchSelectedPages = async () => {
    const pages = resolvedVideos
      .flatMap((video) => video.pages ?? [])
      .filter((page) => selectedPageIds.has(buildVideoPageId(page)))
    const resolveErrorItems = resolvedVideos.filter((item) => !item.ok).map(buildResolveErrorItem)
    await fetchSubtitlesForPages(pages, subtitleLanguage, resolveErrorItems)
  }

  const handleSelectSubtitle = (item: SubtitleItem) => {
    const nextLanguage = item.subtitles?.[0]?.language ?? ""
    setSelectedSubtitle(item)
    setSelectedLanguage(nextLanguage)
    setEditedContent(item.subtitles?.[0]?.content ?? "")
  }

  const handleSelectLanguage = (language: string) => {
    const nextVariant = selectedSubtitle?.subtitles?.find((variant) => variant.language === language)
    setSelectedLanguage(language)
    setEditedContent(nextVariant?.content ?? "")
  }

  const handleSaveSubtitle = (content: string) => {
    if (!selectedSubtitle || !selectedLanguage) return
    const updateItem = (item: SubtitleItem) =>
      item.id === selectedSubtitle.id
        ? {
            ...item,
            subtitles: item.subtitles?.map((variant) =>
              variant.language === selectedLanguage ? { ...variant, content } : variant,
            ),
          }
        : item

    setSubtitles((prev) => prev.map(updateItem))
    setSelectedSubtitle((prev) => (prev ? updateItem(prev) : null))
    setEditedContent(content)
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">B站AI字幕工具</h1>
          <div className="flex items-center gap-3">
            {isLoggedIn && <span className="text-xs text-muted-foreground">已登录</span>}
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <a href={GITHUB_REPOSITORY_URL} target="_blank" rel="noreferrer" aria-label="打开 GitHub 仓库">
                <Github className="h-4 w-4" />
              </a>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-6">
            <section className="p-4 rounded-lg border border-border bg-card">
              <h2 className="text-sm font-medium text-foreground mb-4">账号登录</h2>
              <QrLogin onLoginSuccess={() => setIsLoggedIn(true)} onLogout={handleLogout} />
            </section>

            {isLoggedIn && (
              <section className="p-4 rounded-lg border border-border bg-card">
                <h2 className="text-sm font-medium text-foreground mb-4">添加视频</h2>
                <VideoInput onSubmit={handleResolveVideos} disabled={!isLoggedIn || isResolving || isFetching} />
              </section>
            )}

            {isLoggedIn && resolvedVideos.length > 0 && (
              <section className="p-4 rounded-lg border border-border bg-card">
                <VideoPageSelector
                  videos={resolvedVideos}
                  selectedIds={selectedPageIds}
                  disabled={isResolving || isFetching}
                  onTogglePage={handleTogglePage}
                  onSelectAll={handleSelectAllPages}
                  onClear={handleClearSelectedPages}
                  onSubmit={handleFetchSelectedPages}
                />
              </section>
            )}

            {subtitles.length > 0 && (
              <section className="p-4 rounded-lg border border-border bg-card">
                <h2 className="text-sm font-medium text-foreground mb-4">
                  字幕列表
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    {subtitles.filter((item) => item.status === "success").length}/{subtitles.length}
                  </span>
                </h2>
                <SubtitleList
                  items={subtitles}
                  selectedId={selectedSubtitle?.id}
                  onSelect={handleSelectSubtitle}
                />
              </section>
            )}
          </div>

          <div className="lg:col-span-8 space-y-6">
            <section className="p-4 rounded-lg border border-border bg-card">
              <h2 className="text-sm font-medium text-foreground mb-4">字幕编辑</h2>
              {selectedSubtitle && selectedVariant ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {selectedSubtitle.subtitles?.map((variant) => (
                      <button
                        key={variant.language}
                        type="button"
                        onClick={() => handleSelectLanguage(variant.language)}
                        className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
                          selectedLanguage === variant.language
                            ? "bg-accent/10 border-accent/30 text-foreground"
                            : "border-border text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        {variant.label || variant.language}
                      </button>
                    ))}
                  </div>
                  <SubtitleEditor
                    title={`${selectedSubtitle.title} · ${selectedVariant.label || selectedVariant.language}`}
                    content={selectedVariant.content}
                    onSave={handleSaveSubtitle}
                    onChange={setEditedContent}
                  />
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
                  {isLoggedIn
                    ? subtitles.length > 0
                      ? "从左侧选择一个视频以编辑字幕"
                      : "添加视频后即可获取字幕"
                    : "请先登录账号"}
                </div>
              )}
            </section>

            <section className="p-4 rounded-lg border border-border bg-card">
              <h2 className="text-sm font-medium text-foreground mb-4">导出下载</h2>
              <DownloadPanel
                selected={selectedSubtitle}
                selectedLanguage={selectedLanguage}
                editedContent={editedContent}
                items={subtitles}
              />
            </section>
          </div>
        </div>
      </div>

      <footer className="border-t border-border mt-12">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center text-xs text-muted-foreground">
          登录态只保存在本机，字幕内容来自 B 站官方 AI 字幕。
        </div>
      </footer>
    </main>
  )
}

function findVariant(item: SubtitleItem | null, language: string): SubtitleVariant | undefined {
  if (!item?.subtitles?.length) return undefined
  return item.subtitles.find((variant) => variant.language === language) ?? item.subtitles[0]
}

function toSubtitleVariants(item: SubtitleResult): SubtitleVariant[] {
  return (item.subtitles ?? []).map((subtitle) => ({
    language: subtitle.language,
    label: subtitle.label || subtitle.language,
    content: subtitle.text,
    srt: subtitle.srt,
    rawJson: subtitle.raw_json,
  }))
}

function buildSubtitleItemBase(item: SubtitleResult, fallback?: SubtitleItem): SubtitleItem {
  const bvid = item.bvid || item.source
  const page = typeof item.page === "number" && item.page > 0 ? item.page : undefined
  const title = formatSubtitleTitle(item)
  return {
    id: item.cid ? `${bvid}:${item.cid}` : fallback?.id ?? crypto.randomUUID(),
    bvid,
    cid: item.cid,
    page,
    part: item.part,
    title: title || fallback?.title || item.source,
    status: "loading",
  }
}

function buildLoadingItemFromPage(page: ResolvedVideoPageResult): SubtitleItem {
  return {
    id: buildVideoPageId(page),
    bvid: page.bvid,
    cid: page.cid,
    page: page.page,
    part: page.part,
    title: formatSubtitleTitle(page),
    status: "loading",
  }
}

function buildSubtitleItemFromResult(item: SubtitleResult): SubtitleItem {
  const base = buildSubtitleItemBase(item)
  if (!item.ok) {
    return {
      ...base,
      status: "error",
      error: item.error || "获取失败",
    }
  }

  const variants = toSubtitleVariants(item)
  return {
    ...base,
    status: variants.length > 0 ? "success" : "no-subtitle",
    subtitles: variants,
  }
}

function buildResolveErrorItem(item: ResolvedVideoResult): SubtitleItem {
  return {
    id: item.bvid || item.source || crypto.randomUUID(),
    bvid: item.bvid || item.source,
    title: item.title || item.source,
    status: "error",
    error: item.error || "解析视频失败",
  }
}

function buildRequestErrorItem(source: string, index: number, error: unknown): SubtitleItem {
  return {
    id: `${source || "video"}:${index}`,
    bvid: source,
    title: source || `视频 ${index + 1}`,
    status: "error",
    error: error instanceof Error ? error.message : "请求失败",
  }
}

function upsertSubtitleItem(items: SubtitleItem[], nextItem: SubtitleItem): SubtitleItem[] {
  const index = items.findIndex((item) => item.id === nextItem.id)
  if (index < 0) return [...items, nextItem]
  return items.map((item, itemIndex) => (itemIndex === index ? nextItem : item))
}

function formatSubtitleTitle(item: Pick<SubtitleResult, "page" | "part" | "source" | "title">): string {
  const title = (item.title || item.source || "").trim()
  const part = (item.part || "").trim()
  const page = typeof item.page === "number" && item.page > 0 ? item.page : undefined
  if (!page && !part) return title
  const prefix = page ? `P${page}` : "分P"
  const suffix = part && part !== title ? ` · ${part}` : ""
  return `${title} · ${prefix}${suffix}`
}

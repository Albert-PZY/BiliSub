"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  buildVideoPageId,
  isAbortError,
  postJson,
  streamPostJson,
  type ResolvedVideoPageResult,
  type ResolvedVideoResult,
  type SubtitleLanguageMode,
  type SubtitleStreamEvent,
  type VideoSource,
} from "@/lib/local-api"
import {
  buildSubtitleItemFromResult,
  findSubtitleVariant,
  formatSubtitleTitle,
  updateSubtitleContent,
  upsertSubtitleItem,
  type SubtitleItem,
} from "@/lib/subtitles"

export function useSubtitleWorkspace() {
  const resolveControllerRef = useRef<AbortController | null>(null)
  const subtitleControllerRef = useRef<AbortController | null>(null)
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([])
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string | null>(null)
  const [selectedLanguage, setSelectedLanguage] = useState("")
  const [resolvedVideos, setResolvedVideos] = useState<ResolvedVideoResult[]>([])
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set())
  const [subtitleLanguage, setSubtitleLanguage] = useState<SubtitleLanguageMode>("all")
  const [isResolving, setIsResolving] = useState(false)
  const [isFetching, setIsFetching] = useState(false)

  const selectedSubtitle = useMemo(
    () => subtitles.find((item) => item.id === selectedSubtitleId) ?? null,
    [selectedSubtitleId, subtitles],
  )
  const selectedVariant = useMemo(
    () => findSubtitleVariant(selectedSubtitle, selectedLanguage),
    [selectedLanguage, selectedSubtitle],
  )

  const cancelRequests = useCallback(() => {
    resolveControllerRef.current?.abort()
    subtitleControllerRef.current?.abort()
    resolveControllerRef.current = null
    subtitleControllerRef.current = null
  }, [])

  const clearResults = useCallback(() => {
    setSubtitles([])
    setSelectedSubtitleId(null)
    setSelectedLanguage("")
  }, [])

  const resetWorkspace = useCallback(() => {
    cancelRequests()
    setIsResolving(false)
    setIsFetching(false)
    setResolvedVideos([])
    setSelectedPageIds(new Set())
    clearResults()
  }, [cancelRequests, clearResults])

  useEffect(() => cancelRequests, [cancelRequests])

  const selectSubtitle = useCallback((item: SubtitleItem) => {
    if (item.status !== "success") return
    setSelectedSubtitleId(item.id)
    setSelectedLanguage(item.subtitles?.[0]?.language ?? "")
  }, [])

  const fetchSubtitlesForPages = useCallback(
    async (
      pages: ResolvedVideoPageResult[],
      language: SubtitleLanguageMode,
      initialItems: SubtitleItem[] = [],
    ) => {
      subtitleControllerRef.current?.abort()
      const controller = new AbortController()
      subtitleControllerRef.current = controller
      const loadingItems = pages.map(buildLoadingItemFromPage)
      let selectedFirstSuccess = false

      setIsFetching(true)
      setSubtitles([...initialItems, ...loadingItems])
      setSelectedSubtitleId(null)
      setSelectedLanguage("")

      try {
        await streamPostJson<SubtitleStreamEvent>(
          "/api/subtitles",
          { pages, language },
          (event) => {
            if (event.type === "done") return
            const nextItem = buildSubtitleItemFromResult(event.item)
            setSubtitles((previous) => upsertSubtitleItem(previous, nextItem))

            if (nextItem.status === "success" && !selectedFirstSuccess) {
              selectedFirstSuccess = true
              selectSubtitle(nextItem)
            }
          },
          { signal: controller.signal },
        )
      } catch (error) {
        if (isAbortError(error)) return
        setSubtitles((previous) =>
          previous.map((item) =>
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
        if (subtitleControllerRef.current === controller) {
          subtitleControllerRef.current = null
          setIsFetching(false)
        }
      }
    },
    [selectSubtitle],
  )

  const resolveVideos = useCallback(
    async (videos: VideoSource[], language: SubtitleLanguageMode) => {
      cancelRequests()
      const controller = new AbortController()
      resolveControllerRef.current = controller
      setIsResolving(true)
      setIsFetching(false)
      setSubtitleLanguage(language)
      setResolvedVideos([])
      setSelectedPageIds(new Set())
      clearResults()

      let pagesToFetch: ResolvedVideoPageResult[] | null = null
      let initialItems: SubtitleItem[] = []

      try {
        const payload = await postJson<{ items: ResolvedVideoResult[] }>(
          "/api/videos/resolve",
          { sources: videos.map((video) => video.url) },
          { signal: controller.signal },
        )
        const items = payload.items
        const pages = items.flatMap((item) => item.pages ?? [])
        const resolveErrors = items.filter((item) => !item.ok).map(buildResolveErrorItem)
        const needsPageSelection = items.some((item) => (item.pages?.length ?? 0) > 1)
        const defaultPages = needsPageSelection
          ? items.flatMap((item) => ((item.pages?.length ?? 0) === 1 ? item.pages ?? [] : []))
          : pages

        setResolvedVideos(items)
        setSelectedPageIds(new Set(defaultPages.map(buildVideoPageId)))

        if (!needsPageSelection && pages.length > 0) {
          pagesToFetch = pages
          initialItems = resolveErrors
        } else if (resolveErrors.length > 0) {
          setSubtitles(resolveErrors)
        }

        if (pages.length === 0) {
          setSubtitles(resolveErrors.length > 0 ? resolveErrors : items.map(buildResolveErrorItem))
        }
      } catch (error) {
        if (isAbortError(error)) return
        setSubtitles(videos.map((video, index) => buildRequestErrorItem(video.url, index, error)))
      } finally {
        if (resolveControllerRef.current === controller) {
          resolveControllerRef.current = null
          setIsResolving(false)
        }
      }

      if (pagesToFetch && !controller.signal.aborted) {
        await fetchSubtitlesForPages(pagesToFetch, language, initialItems)
      }
    },
    [cancelRequests, clearResults, fetchSubtitlesForPages],
  )

  const togglePage = useCallback((page: ResolvedVideoPageResult) => {
    const pageId = buildVideoPageId(page)
    setSelectedPageIds((previous) => {
      const next = new Set(previous)
      if (next.has(pageId)) next.delete(pageId)
      else next.add(pageId)
      return next
    })
  }, [])

  const selectAllPages = useCallback(() => {
    const pages = resolvedVideos.flatMap((video) => video.pages ?? [])
    setSelectedPageIds(new Set(pages.map(buildVideoPageId)))
  }, [resolvedVideos])

  const clearSelectedPages = useCallback(() => setSelectedPageIds(new Set()), [])

  const fetchSelectedPages = useCallback(async () => {
    const pages = resolvedVideos
      .flatMap((video) => video.pages ?? [])
      .filter((page) => selectedPageIds.has(buildVideoPageId(page)))
    if (pages.length === 0) return
    const resolveErrors = resolvedVideos.filter((item) => !item.ok).map(buildResolveErrorItem)
    await fetchSubtitlesForPages(pages, subtitleLanguage, resolveErrors)
  }, [fetchSubtitlesForPages, resolvedVideos, selectedPageIds, subtitleLanguage])

  const selectLanguage = useCallback((language: string) => setSelectedLanguage(language), [])

  const changeSelectedContent = useCallback(
    (content: string) => {
      if (!selectedSubtitleId || !selectedLanguage) return
      setSubtitles((previous) => updateSubtitleContent(previous, selectedSubtitleId, selectedLanguage, content))
    },
    [selectedLanguage, selectedSubtitleId],
  )

  const resetSelectedContent = useCallback(() => {
    if (!selectedVariant) return
    changeSelectedContent(selectedVariant.originalContent)
  }, [changeSelectedContent, selectedVariant])

  const successCount = subtitles.filter((item) => item.status === "success").length
  return {
    subtitles,
    selectedSubtitle,
    selectedVariant,
    selectedLanguage,
    resolvedVideos,
    selectedPageIds,
    isResolving,
    isFetching,
    isBusy: isResolving || isFetching,
    needsPageSelection: resolvedVideos.some((item) => (item.pages?.length ?? 0) > 1),
    successCount,
    resetWorkspace,
    resolveVideos,
    togglePage,
    selectAllPages,
    clearSelectedPages,
    fetchSelectedPages,
    selectSubtitle,
    selectLanguage,
    changeSelectedContent,
    resetSelectedContent,
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

function buildResolveErrorItem(item: ResolvedVideoResult): SubtitleItem {
  return {
    id: `resolve:${item.bvid || item.source}`,
    bvid: item.bvid || item.source,
    title: item.title || item.source,
    status: "error",
    error: item.error || "解析视频失败",
  }
}

function buildRequestErrorItem(source: string, index: number, error: unknown): SubtitleItem {
  return {
    id: `request:${source || "video"}:${index}`,
    bvid: source,
    title: source || `视频 ${index + 1}`,
    status: "error",
    error: error instanceof Error ? error.message : "请求失败",
  }
}

'use client'


import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  buildVideoPageId,
  clearSessionToken,
  isAbortError,
  postJson,
  streamPostJson,
  ApiError,
  type ResolvedVideoPageResult,
  type ResolvedVideoResult,
  type SubtitleLanguageMode,
  type SubtitleStreamEvent,
  type VideoSource,
} from "@/lib/local-api"
import {
  buildLoadingItemFromPage,
  buildRequestErrorItem,
  buildResolveErrorItem,
  buildSubtitleItemFromResult,
  countSubtitleTasks,
  findSubtitleVariant,
  hasUnexportedEdits,
  mergeSubtitleItems,
  upsertSubtitleItem,
  updateSubtitleContent,
  type SubtitleItem,
} from "@/lib/subtitles"

export function useSubtitleWorkspace({ onAuthExpired }: { onAuthExpired?: () => void } = {}) {
  const resolveControllerRef = useRef<AbortController | null>(null)
  const subtitleControllerRef = useRef<AbortController | null>(null)
  const resolveRequestIdRef = useRef(0)
  const subtitleRequestIdRef = useRef(0)
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([])
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string | null>(null)
  const selectedSubtitleIdRef = useRef<string | null>(null)
  selectedSubtitleIdRef.current = selectedSubtitleId
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
    resolveRequestIdRef.current += 1
    subtitleRequestIdRef.current += 1
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
      mode: "replace" | "append" = "replace",
    ) => {
      const requestId = ++subtitleRequestIdRef.current
      subtitleControllerRef.current?.abort()
      const controller = new AbortController()
      subtitleControllerRef.current = controller
      const isCurrentRequest = () =>
        subtitleRequestIdRef.current === requestId
        && subtitleControllerRef.current === controller
        && !controller.signal.aborted
      const loadingItems = pages.map(buildLoadingItemFromPage)
      let selectedFirstSuccess = false
      setIsFetching(true)
      if (mode === "append") {
        // 增量追加：保留已有 success/loading（尤其单 P 先行得到的字幕），追加新的多 P loading 项
        setSubtitles((previous) => mergeSubtitleItems([...previous, ...initialItems], loadingItems))
      } else {
        setSubtitles([...initialItems, ...loadingItems])
        setSelectedSubtitleId(null)
        setSelectedLanguage("")
      }

      try {
        await streamPostJson<SubtitleStreamEvent>(
          "/api/subtitles",
          { pages, language },
          (event) => {
            if (!isCurrentRequest()) return
            if (event.type === "done") return
            if (event.type === "auth-expired") {
              clearSessionToken()
              onAuthExpired?.()
              setSubtitles((previous) => previous.map((item) => item.status === "loading"
                ? { ...item, status: "error" as const, error: event.message }
                : item))
              return
            }
            const nextItem = buildSubtitleItemFromResult(event.item)
            setSubtitles((previous) => upsertSubtitleItem(previous, nextItem))

            if (
              nextItem.status === "success" &&
              !selectedFirstSuccess &&
              !(mode === "append" && selectedSubtitleIdRef.current)
            ) {
              selectedFirstSuccess = true
              selectSubtitle(nextItem)
            }
          },

          { signal: controller.signal },
        )
      } catch (error) {
        if (!isCurrentRequest() || isAbortError(error)) return
        if (error instanceof ApiError && error.status === 401) {
          clearSessionToken()
          onAuthExpired?.()
        }
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
    [onAuthExpired, selectSubtitle]
  )

  const resolveVideos = useCallback(
    async (videos: VideoSource[], language: SubtitleLanguageMode) => {
      // 重新解析前检查未导出的编辑，确认后清空旧结果。
      if (hasUnexportedEdits(subtitles)) {
        const confirmed = typeof window !== "undefined"
          ? window.confirm("当前已有未导出的编辑内容，重新解析会清空这些字幕与编辑，是否继续？")
          : true
        if (!confirmed) return
      }

      cancelRequests()
      const controller = new AbortController()
      resolveControllerRef.current = controller
      const requestId = resolveRequestIdRef.current
      const isCurrentResolveRequest = () =>
        resolveRequestIdRef.current === requestId
        && !controller.signal.aborted
      setIsResolving(true)
      setIsFetching(false)
      setSubtitleLanguage(language)
      setResolvedVideos([])
      setSelectedPageIds(new Set())
      clearResults()

      let singlePagesToFetch: ResolvedVideoPageResult[] | null = null
      let resolveErrors: SubtitleItem[] = []

      try {
        const payload = await postJson<{ items: ResolvedVideoResult[] }>(
          "/api/videos/resolve",
          { sources: videos.map((video) => video.url) },
          { signal: controller.signal },
        )
        if (!isCurrentResolveRequest()) return
        const items = payload.items
        const needsPageSelection = items.some((item) => (item.pages?.length ?? 0) > 1)
        resolveErrors = items.filter((item) => !item.ok).map(buildResolveErrorItem)

        // 单 P 自动获取；多 P 留给选择器决定处理范围。
        const singlePages = items.flatMap((item) =>
          (item.pages?.length ?? 0) === 1 ? item.pages ?? [] : [],
        )
        const allPages = items.flatMap((item) => item.pages ?? [])

        setResolvedVideos(items)
        // 全部为单 P（无多 P 视频）时，全量选中所有页；含多 P 时，只选中单 P 页让用户决定多 P
        const defaultSelected = needsPageSelection ? singlePages : allPages
        setSelectedPageIds(new Set(defaultSelected.map(buildVideoPageId)))

        if (items.some((item) => item.ok) && singlePages.length > 0) {
          singlePagesToFetch = singlePages
        } else if (resolveErrors.length > 0) {
          setSubtitles(resolveErrors)
        }

        if (allPages.length === 0) {
          setSubtitles(resolveErrors.length > 0 ? resolveErrors : items.map(buildResolveErrorItem))
        }
      } catch (error) {
        if (!isCurrentResolveRequest() || isAbortError(error)) return
        if (error instanceof ApiError && error.status === 401) {
          clearSessionToken()
          onAuthExpired?.()
        }
        setSubtitles(videos.map((video, index) => buildRequestErrorItem(video.url, index, error)))
      } finally {
        if (resolveControllerRef.current === controller) {
          resolveControllerRef.current = null
          setIsResolving(false)
        }
      }

      if (singlePagesToFetch && !controller.signal.aborted) {
        await fetchSubtitlesForPages(singlePagesToFetch, language, resolveErrors, "replace")
      }
    },
    [cancelRequests, clearResults, fetchSubtitlesForPages, onAuthExpired, subtitles],
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
    const pages = resolvedVideos
      .filter((video) => (video.pages?.length ?? 0) > 1)
      .flatMap((video) => video.pages ?? [])
    setSelectedPageIds(new Set(pages.map(buildVideoPageId)))
  }, [resolvedVideos])

  const clearSelectedPages = useCallback(() => setSelectedPageIds(new Set()), [])

  const fetchSelectedPages = useCallback(async () => {
    // 在已有字幕上增量追加多 P 结果，不覆盖已获取的单 P。
    const candidatePages = resolvedVideos
      .filter((video) => (video.pages?.length ?? 0) > 1)
      .flatMap((video) => video.pages ?? [])
      .filter((page) => selectedPageIds.has(buildVideoPageId(page)))
    // 跳过已经成功或正在加载的分 P，避免重复请求。
    const pagesToFetch = candidatePages.filter((page) => {
      const id = buildVideoPageId(page)
      return !subtitles.some(
        (item) => item.id === id && (item.status === "success" || item.status === "loading"),
      )
    })
    if (pagesToFetch.length === 0) return
    await fetchSubtitlesForPages(pagesToFetch, subtitleLanguage, [], "append")
  }, [fetchSubtitlesForPages, resolvedVideos, selectedPageIds, subtitleLanguage, subtitles])

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
  // 任务分母只计算进入字幕获取流程的项目，不含解析失败占位。
  const taskCount = countSubtitleTasks(subtitles)
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
    taskCount,
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

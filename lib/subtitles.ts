import { buildVideoPageId } from "@/lib/local-api"
import type { ResolvedVideoPageResult, ResolvedVideoResult, SubtitleResult } from "@/lib/local-api"


export interface SubtitleVariant {
  language: string
  label: string
  content: string
  originalContent: string
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
  /**
   * 区分“字幕获取任务”与“解析视频失败”两类占位项：
   * - `subtitle`：进入字幕获取流程的页（loading/success/error/no-subtitle 均属此类）
   * - `resolve-error`：BV 解析阶段就失败，没进入字幕获取，不参与“成功 X/Y”分母
   */
  kind?: "subtitle" | "resolve-error"
  subtitles?: SubtitleVariant[]
  error?: string
}

/** 是否存在未导出的编辑内容（用于重新解析前二次确认）。 */
export function hasUnexportedEdits(items: SubtitleItem[]): boolean {
  return items.some(
    (item) =>
      item.status === "success" &&
      item.subtitles?.some((variant) => variant.content !== variant.originalContent) === true,
  )
}

/** 用于字幕获取流程的“成功 X/Y”分母：只算进入过字幕获取流程的项。 */
export function countSubtitleTasks(items: SubtitleItem[]): number {
  return items.filter((item) => item.kind !== "resolve-error").length
}

export function findSubtitleVariant(item: SubtitleItem | null, language: string): SubtitleVariant | undefined {
  if (!item?.subtitles?.length) return undefined
  return item.subtitles.find((variant) => variant.language === language) ?? item.subtitles[0]
}

export function buildSubtitleItemFromResult(item: SubtitleResult): SubtitleItem {
  const base = buildSubtitleItemBase(item)
  if (!item.ok) {
    return {
      ...base,
      kind: "subtitle",
      status: "error",
      error: item.error || "获取失败",
    }
  }

  const variants = (item.subtitles ?? []).map((subtitle) => ({
    language: subtitle.language,
    label: subtitle.label || subtitle.language,
    content: subtitle.text,
    originalContent: subtitle.text,
    srt: subtitle.srt,
    rawJson: subtitle.raw_json,
  }))

  return {
    ...base,
    kind: "subtitle",
    status: variants.length > 0 ? "success" : "no-subtitle",
    subtitles: variants,
  }
}

export function buildSubtitleItemBase(item: SubtitleResult): SubtitleItem {
  const bvid = item.bvid || item.source
  return {
    id: item.cid ? `${bvid}:${item.cid}` : `subtitle:${bvid}`,
    bvid,
    cid: item.cid,
    page: typeof item.page === "number" && item.page > 0 ? item.page : undefined,
    part: item.part,
    title: formatSubtitleTitle(item) || item.source,
    status: "loading",
  }
}

export function upsertSubtitleItem(items: SubtitleItem[], nextItem: SubtitleItem): SubtitleItem[] {
  const index = items.findIndex((item) => item.id === nextItem.id)
  if (index < 0) return [...items, nextItem]
  return items.map((item, itemIndex) => (itemIndex === index ? nextItem : item))
}

export function updateSubtitleContent(
  items: SubtitleItem[],
  itemId: string,
  language: string,
  content: string,
): SubtitleItem[] {
  return items.map((item) => {
    if (item.id !== itemId) return item
    return {
      ...item,
      subtitles: item.subtitles?.map((variant) =>
        variant.language === language ? { ...variant, content } : variant,
      ),
    }
  })
}

export function formatSubtitleTitle(
  item: Pick<SubtitleResult, "page" | "part" | "source" | "title">,
): string {
  const title = (item.title || item.source || "").trim()
  const part = (item.part || "").trim()
  const page = typeof item.page === "number" && item.page > 0 ? item.page : undefined
  if (!page && !part) return title
  const prefix = page ? `P${page}` : "分P"
  const suffix = part && part !== title ? ` · ${part}` : ""
  return `${title} · ${prefix}${suffix}`
}

/** 把一个分 P 构造为“加载中”字幕项（进入字幕获取流程，参与成功分母计数）。 */
export function buildLoadingItemFromPage(page: ResolvedVideoPageResult): SubtitleItem {
  return {
    id: buildVideoPageId(page),
    bvid: page.bvid,
    cid: page.cid,
    page: page.page,
    part: page.part,
    title: formatSubtitleTitle(page),
    kind: "subtitle",
    status: "loading",
  }
}

/** 解析视频阶段就失败的占位项（不进入字幕获取，不计入成功分母）。 */
export function buildResolveErrorItem(item: ResolvedVideoResult): SubtitleItem {
  return {
    id: `resolve:${item.bvid || item.source}`,
    bvid: item.bvid || item.source,
    title: item.title || item.source,
    kind: "resolve-error",
    status: "error",
    error: item.error || "解析视频失败",
  }
}

/** 请求解析接口阶段就失败的占位项（同 resolve-error，按来源区分 id）。 */
export function buildRequestErrorItem(source: string, index: number, error: unknown): SubtitleItem {
  return {
    id: `request:${source || "video"}:${index}`,
    bvid: source,
    title: source || `视频 ${index + 1}`,
    kind: "resolve-error",
    status: "error",
    error: error instanceof Error ? error.message : "请求失败",
  }
}

/** append 模式合并：保留 previous 已有项原序，incoming 中新 id 追加到末尾；已存在 success/loading 的不覆盖。 */
export function mergeSubtitleItems(previous: SubtitleItem[], incoming: SubtitleItem[]): SubtitleItem[] {
  const existing = new Map<string, SubtitleItem>(previous.map((item) => [item.id, item]))
  const appended: SubtitleItem[] = []
  for (const next of incoming) {
    const current = existing.get(next.id)
    if (current) {
      // 已完成或进行中的保留原态，不重拉；error/no-subtitle 允许用新项覆盖
      if (current.status === "success" || current.status === "loading") continue
      existing.set(next.id, next)
    } else {
      existing.set(next.id, next)
      appended.push(next)
    }
  }
  // 保持 previous 原顺序，新项追加到末尾
  return [...previous.map((item) => existing.get(item.id) ?? item), ...appended]
}

import type { SubtitleResult } from "@/lib/local-api"

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
  subtitles?: SubtitleVariant[]
  error?: string
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

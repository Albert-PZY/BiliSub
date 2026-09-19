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
  return items.flatMap((item, itemIndex) => {
    if (item.id !== nextItem.id) return [item]
    return itemIndex === index ? [nextItem] : []
  })
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

export function buildSrtOutput(variant: SubtitleVariant): string {
  if (variant.content === variant.originalContent && variant.srt?.trim()) return variant.srt

  const editedLines = splitEditedLines(variant.content)
  const blocks = parseSrtBlocks(variant.srt ?? "")
  if (blocks.length > 0) {
    // 保留原有时间轴；纯文本编辑无法判断换行是否代表新的字幕条目，未匹配的行归入最近的条目。
    const originalLines = splitEditedLines(variant.originalContent)
    const originalTexts = blocks.map((block, index) => originalLines[index] ?? block.text)
    const cueTexts = mapEditedLinesToSlots(originalTexts, editedLines)
    return blocks
      .map((block, index) => [block.header || String(index + 1), block.timeline, cueTexts[index] ?? ""].join("\n"))
      .join("\n\n")
  }

  return buildFallbackSrt(editedLines)
}

export function buildJsonOutput(variant: SubtitleVariant): string {
  if (variant.content === variant.originalContent && variant.rawJson?.trim()) return variant.rawJson

  const parsed = parseJson(variant.rawJson)
  if (parsed !== undefined) {
    const updated = updateKnownSubtitleJson(parsed, splitEditedLines(variant.content))
    if (updated !== undefined) return JSON.stringify(updated, null, 2)
  }

  return JSON.stringify({ language: variant.language, text: variant.content }, null, 2)
}

function splitEditedLines(content: string): string[] {
  return content.replace(/\r\n?/g, "\n").split("\n")
}

type SrtBlock = { header: string; timeline: string; text: string }

function parseSrtBlocks(srt: string): SrtBlock[] {
  return srt
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((raw) => raw.trim())
    .flatMap((raw) => {
      const lines = raw.split("\n")
      const timelineIndex = lines.findIndex((line) => /\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}/.test(line))
      if (timelineIndex < 0) return []
      return [{
        header: timelineIndex > 0 ? lines.slice(0, timelineIndex).join("\n") : "",
        timeline: lines[timelineIndex],
        text: lines.slice(timelineIndex + 1).join("\n"),
      }]
    })
}

function buildFallbackSrt(lines: string[]): string {
  const safeLines = lines.length > 0 ? lines : [""]
  return safeLines
    .map((line, index) => {
      const start = index * 5
      return [String(index + 1), `${formatSrtTimestamp(start)} --> ${formatSrtTimestamp(start + 5)}`, line].join("\n")
    })
    .join("\n\n")
}

type TextField = "content" | "content_text" | "text" | "utf8"
const subtitleTextKeys = new Set<TextField>(["content", "content_text", "text", "utf8"])

function updateKnownSubtitleJson(value: unknown, editedLines: string[]): unknown | undefined {
  if (Array.isArray(value)) {
    if (value.some(isBodyCue)) return replaceBodyCues(value, editedLines)
    return undefined
  }
  if (!value || typeof value !== "object") return undefined

  const record = value as Record<string, unknown>
  if (Array.isArray(record.body) && record.body.some(isBodyCue)) {
    return { ...record, body: replaceBodyCues(record.body, editedLines) }
  }
  if (Array.isArray(record.events) && record.events.some(isEventCue)) {
    return { ...record, events: replaceEventCues(record.events, editedLines) }
  }

  // 某些 API 响应会把字幕数据包裹在 data 或 result 中。
  // 先处理 B 站已知的顶层结构，再递归检查这些容器。
  for (const [key, child] of Object.entries(record)) {
    const updated = updateKnownSubtitleJson(child, editedLines)
    if (updated !== undefined) return { ...record, [key]: updated }
  }
  return undefined
}

function isBodyCue(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  const hasText = Object.entries(record).some(([key, child]) => subtitleTextKeys.has(key as TextField) && typeof child === "string")
  const hasTiming = ["from", "to", "start", "end", "from_ms", "to_ms"].some((key) => key in record)
  return hasText && hasTiming
}

function isEventCue(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const segs = (value as Record<string, unknown>).segs
  return Array.isArray(segs) && segs.some((segment) => getTextFields(segment).length > 0)
}

function replaceBodyCues(items: unknown[], editedLines: string[]): unknown[] {
  const cueIndexes = items.flatMap((item, index) => isBodyCue(item) ? [index] : [])
  const cuePositions = new Map(cueIndexes.map((index, position) => [index, position]))
  const originalTexts = cueIndexes.map((index) => getObjectText(items[index]))
  const cueTexts = mapEditedLinesToSlots(originalTexts, editedLines)
  return items.map((item, index) => {
    const cueIndex = cuePositions.get(index)
    if (cueIndex === undefined || !item || typeof item !== "object" || Array.isArray(item)) return item
    return replaceObjectText(item as Record<string, unknown>, cueTexts[cueIndex] ?? "")
  })
}

function replaceEventCues(items: unknown[], editedLines: string[]): unknown[] {
  const cueIndexes = items.flatMap((item, index) => isEventCue(item) ? [index] : [])
  const cuePositions = new Map(cueIndexes.map((index, position) => [index, position]))
  const originalTexts = cueIndexes.map((index) => getEventText(items[index]))
  const cueTexts = mapEditedLinesToSlots(originalTexts, editedLines)
  return items.map((item, index) => {
    const cueIndex = cuePositions.get(index)
    if (cueIndex === undefined || !item || typeof item !== "object" || Array.isArray(item)) return item
    const record = item as Record<string, unknown>
    const segs = Array.isArray(record.segs) ? record.segs : []
    let assigned = false
    const updatedSegs = segs.map((segment) => {
      const fields = getTextFields(segment)
      if (fields.length === 0) return segment
      const text = assigned ? "" : cueTexts[cueIndex] ?? ""
      assigned = true
      return replaceObjectText(segment as Record<string, unknown>, text)
    })
    return { ...record, segs: updatedSegs }
  })
}

function getTextFields(value: unknown): [TextField, string][] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return []
  const fields: [TextField, string][] = []
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (subtitleTextKeys.has(key as TextField) && typeof child === "string") fields.push([key as TextField, child])
  }
  return fields
}

function getObjectText(value: unknown): string {
  return getTextFields(value)[0]?.[1] ?? ""
}

function getEventText(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return ""
  const segs = (value as Record<string, unknown>).segs
  return Array.isArray(segs) ? segs.map(getObjectText).join("") : ""
}

function replaceObjectText(record: Record<string, unknown>, text: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).map(([key, child]) =>
    subtitleTextKeys.has(key as TextField) && typeof child === "string" ? [key, text] : [key, child],
  ))
}

function mapEditedLinesToSlots(originalTexts: string[], editedLines: string[]): string[] {
  if (originalTexts.length === 0) return []
  if (originalTexts.length === editedLines.length) return [...editedLines]

  const slots = Array.from({ length: originalTexts.length }, () => "")
  const anchors = findTextAnchors(originalTexts, editedLines)
  if (anchors.length === 0) {
    const shared = Math.min(slots.length, editedLines.length)
    for (let index = 0; index < shared; index += 1) slots[index] = editedLines[index]
    if (editedLines.length > slots.length) {
      slots[slots.length - 1] = appendLines(slots[slots.length - 1], editedLines.slice(slots.length).join("\n"))
    }
    return slots
  }

  let previousOriginal = -1
  let previousEdited = -1
  for (const anchor of anchors) {
    assignGap(slots, editedLines, previousOriginal + 1, anchor.originalIndex - 1, previousEdited + 1, anchor.editedIndex - 1, previousOriginal, anchor.originalIndex)
    slots[anchor.originalIndex] = editedLines[anchor.editedIndex]
    previousOriginal = anchor.originalIndex
    previousEdited = anchor.editedIndex
  }
  assignGap(slots, editedLines, previousOriginal + 1, originalTexts.length - 1, previousEdited + 1, editedLines.length - 1, previousOriginal, -1)
  return slots
}

function assignGap(
  slots: string[],
  editedLines: string[],
  originalStart: number,
  originalEnd: number,
  editedStart: number,
  editedEnd: number,
  previousOriginal: number,
  nextOriginal: number,
): void {
  if (editedStart > editedEnd) {
    for (let index = originalStart; index <= originalEnd; index += 1) slots[index] = ""
    return
  }
  if (originalStart > originalEnd) {
    const extra = editedLines.slice(editedStart, editedEnd + 1).join("\n")
    if (previousOriginal >= 0) slots[previousOriginal] = appendLines(slots[previousOriginal], extra)
    else if (nextOriginal >= 0) slots[nextOriginal] = prependLines(slots[nextOriginal], extra)
    return
  }

  const originalCount = originalEnd - originalStart + 1
  const editedCount = editedEnd - editedStart + 1
  const shared = Math.min(originalCount, editedCount)
  for (let offset = 0; offset < shared; offset += 1) slots[originalStart + offset] = editedLines[editedStart + offset]
  if (editedCount > originalCount) {
    slots[originalEnd] = appendLines(slots[originalEnd], editedLines.slice(editedStart + shared, editedEnd + 1).join("\n"))
  }
  for (let offset = shared; offset < originalCount; offset += 1) slots[originalStart + offset] = ""
}

type TextAnchor = { originalIndex: number; editedIndex: number }

function findTextAnchors(originalTexts: string[], editedLines: string[]): TextAnchor[] {
  const positions = new Map<string, number[]>()
  originalTexts.forEach((text, index) => {
    const key = normalizeComparableText(text)
    const bucket = positions.get(key) ?? []
    bucket.push(index)
    positions.set(key, bucket)
  })
  const anchors: TextAnchor[] = []
  let previousOriginal = -1
  editedLines.forEach((line, editedIndex) => {
    const bucket = positions.get(normalizeComparableText(line)) ?? []
    const originalIndex = bucket.find((index) => index > previousOriginal)
    if (originalIndex === undefined) return
    anchors.push({ originalIndex, editedIndex })
    previousOriginal = originalIndex
  })
  return anchors
}

function normalizeComparableText(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function appendLines(base: string, extra: string): string {
  if (!base) return extra
  if (!extra) return base
  return `${base}\n${extra}`
}

function prependLines(base: string, extra: string): string {
  if (!base) return extra
  if (!extra) return base
  return `${extra}\n${base}`
}

function parseJson(rawJson?: string): unknown | undefined {
  if (!rawJson?.trim()) return undefined
  try {
    return JSON.parse(rawJson) as unknown
  } catch {
    return undefined
  }
}

function formatSrtTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},000`
}

export function formatSubtitleTitle(
  item: Pick<SubtitleResult, "page" | "part" | "source" | "title">,
): string {
  const title = (item.title || item.source || "").trim()
  const part = (item.part || "").trim()
  const page = typeof item.page === "number" && item.page > 0 ? item.page : undefined
  if (!page && !part) return title
  const pageLabel = page ? `P${page}` : "分P"
  const partPage = part.match(/^P0*(\d+)$/i)?.[1]
  const suffix = part && part !== title && !(page && partPage && Number(partPage) === page) ? ` · ${part}` : ""
  return `${title} · ${pageLabel}${suffix}`
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

/** 追加字幕结果，保留首次出现的顺序，并避免同一个分 P 重复显示。 */
export function mergeSubtitleItems(previous: SubtitleItem[], incoming: SubtitleItem[]): SubtitleItem[] {
  const items = new Map<string, SubtitleItem>()
  const order: string[] = []
  const protectedIds = new Set<string>()

  for (const item of previous) {
    const current = items.get(item.id)
    if (!current) {
      items.set(item.id, item)
      order.push(item.id)
    } else if (!protectedIds.has(item.id) && (item.status === "success" || item.status === "loading")) {
      items.set(item.id, item)
    }
    if (item.status === "success" || item.status === "loading") protectedIds.add(item.id)
  }

  for (const item of incoming) {
    if (protectedIds.has(item.id)) continue
    if (!items.has(item.id)) order.push(item.id)
    items.set(item.id, item)
  }

  return order.flatMap((id) => {
    const item = items.get(id)
    return item ? [item] : []
  })
}

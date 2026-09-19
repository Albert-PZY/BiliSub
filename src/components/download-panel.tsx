import { useEffect, useMemo, useRef, useState } from "react"
import { Braces, CheckCircle2, Download, FileText, Loader2, TimerReset } from "lucide-react"
import { useToast } from "@/components/ui/toast"
import { buildJsonOutput, buildSrtOutput, type SubtitleItem, type SubtitleVariant } from "@/lib/subtitles"

type FormatType = "txt" | "srt" | "json"
type DownloadScope = "current" | "video" | "all"

const formats: { type: FormatType; label: string; desc: string; icon: typeof FileText }[] = [
  { type: "txt", label: "TXT 文本", desc: "使用当前编辑内容", icon: FileText },
  { type: "srt", label: "SRT 字幕", desc: "保留原始时间轴", icon: TimerReset },
  { type: "json", label: "JSON 数据", desc: "保留原始结构", icon: Braces },
]

export function DownloadPanel({
  selected,
  selectedLanguage,
  items = [],
}: {
  selected?: SubtitleItem | null
  selectedLanguage?: string
  items?: SubtitleItem[]
}) {
  const { toast } = useToast()
  const [scope, setScope] = useState<DownloadScope>("current")
  const [downloadedCount, setDownloadedCount] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const downloadedTimerRef = useRef<number | null>(null)
  const successful = useMemo(() => items.filter((item) => item.status === "success"), [items])
  const currentVariant = selected ? findVariant(selected, selectedLanguage) : undefined
  const targets = useMemo(
    () => getDownloadTargets({ scope, items: successful, selected, currentVariant }),
    [currentVariant, scope, selected, successful],
  )

  useEffect(() => () => {
    if (downloadedTimerRef.current !== null) window.clearTimeout(downloadedTimerRef.current)
  }, [])

  const scopes: { value: DownloadScope; label: string; count: number; disabled: boolean }[] = [
    { value: "current", label: "当前语言", count: currentVariant ? 1 : 0, disabled: !currentVariant },
    { value: "video", label: "当前视频", count: selected?.status === "success" ? selected.subtitles?.length ?? 0 : 0, disabled: selected?.status !== "success" },
    { value: "all", label: "全部字幕", count: successful.reduce((count, item) => count + (item.subtitles?.length ?? 0), 0), disabled: successful.length === 0 },
  ]

  const handleDownload = async (format: FormatType) => {
    if (targets.length === 0 || isExporting) return
    setIsExporting(true)
    try {
      for (let index = 0; index < targets.length; index += 1) {
        const target = targets[index]
        downloadFile(
          `${buildSubtitleFileStem(target.item)}.${safeFileName(target.variant.language)}.${format}`,
          buildOutput(target.variant, format),
          format,
        )
        if (index < targets.length - 1) await new Promise((resolve) => window.setTimeout(resolve, 150))
      }
      setDownloadedCount(targets.length)
      if (downloadedTimerRef.current !== null) window.clearTimeout(downloadedTimerRef.current)
      downloadedTimerRef.current = window.setTimeout(() => {
        setDownloadedCount(0)
        downloadedTimerRef.current = null
      }, 1800)
      toast(targets.length > 1 ? `已生成 ${targets.length} 个文件，若浏览器拦截请在地址栏允许` : "已生成 1 个文件", "success")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="export-panel">
      <div className="scope-tabs" role="group" aria-label="导出范围">
        {scopes.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={scope === item.value}
            onClick={() => {
              setScope(item.value)
              setDownloadedCount(0)
            }}
            disabled={item.disabled}
            className={`scope-tab${scope === item.value ? " scope-tab--active" : ""}`}
          >
            <span>{item.label}</span>
            <span className="scope-tab__count">{item.count} 个文件</span>
          </button>
        ))}
      </div>

      <div className="format-grid">
        {formats.map((format) => {
          const Icon = format.icon
          return (
            <button
              key={format.type}
              type="button"
              className="format-button"
              onClick={() => handleDownload(format.type)}
              disabled={targets.length === 0 || isExporting}
            >
              <span className="format-button__icon">
                {isExporting ? <Loader2 size={15} className="spin" aria-hidden="true" /> : <Icon size={15} aria-hidden="true" />}
              </span>
              <span className="format-button__copy">
                <span className="format-button__label">{isExporting && targets.length > 1 ? `正在导出 ${targets.length} 个…` : format.label}</span>
                <span className="format-button__desc">{format.desc}</span>
              </span>
              <Download size={14} aria-hidden="true" />
            </button>
          )
        })}
      </div>

      {downloadedCount > 0 && (
        <p className="export-success" aria-live="polite"><CheckCircle2 size={14} aria-hidden="true" />已生成 {downloadedCount} 个文件</p>
      )}
    </div>
  )
}

function findVariant(item: SubtitleItem, selectedLanguage?: string): SubtitleVariant | undefined {
  if (!item.subtitles?.length) return undefined
  return item.subtitles.find((variant) => variant.language === selectedLanguage) ?? item.subtitles[0]
}

function getDownloadTargets({
  scope,
  items,
  selected,
  currentVariant,
}: {
  scope: DownloadScope
  items: SubtitleItem[]
  selected?: SubtitleItem | null
  currentVariant?: SubtitleVariant
}) {
  if (scope === "current") return selected && currentVariant ? [{ item: selected, variant: currentVariant }] : []
  const sourceItems = scope === "video" && selected ? [selected] : items
  return sourceItems.flatMap((item) => (item.subtitles ?? []).map((variant) => ({ item, variant })))
}

function buildOutput(variant: SubtitleVariant, format: FormatType): string {
  if (format === "txt") return variant.content
  if (format === "srt") return buildSrtOutput(variant)
  return buildJsonOutput(variant)
}

function downloadFile(fileName: string, content: string, format: FormatType): void {
  const mimeType = format === "json" ? "application/json" : "text/plain"
  const url = URL.createObjectURL(new Blob([content], { type: `${mimeType};charset=utf-8` }))
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function safeFileName(value: string): string {
  const match = value.match(/BV[0-9A-Za-z]{10}/)
  return (match ? match[0] : value).replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80) || "bili-ai-sub"
}

function buildSubtitleFileStem(item: SubtitleItem): string {
  const bvid = safeFileName(item.bvid)
  if (item.page) return `${bvid}.P${String(item.page).padStart(2, "0")}`
  if (item.cid) return `${bvid}.${safeFileName(item.cid)}`
  return bvid
}

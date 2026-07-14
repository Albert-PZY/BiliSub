"use client"

import { useMemo, useState } from "react"
import { Braces, CheckCircle2, Download, FileText, TimerReset } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { SubtitleItem, SubtitleVariant } from "@/lib/subtitles"

type FormatType = "txt" | "srt" | "json"
type DownloadScope = "current" | "video" | "all"

const formats: { type: FormatType; label: string; desc: string; icon: typeof FileText }[] = [
  { type: "txt", label: "TXT 文本", desc: "包含本页编辑内容", icon: FileText },
  { type: "srt", label: "SRT 字幕", desc: "保留原始时间轴", icon: TimerReset },
  { type: "json", label: "JSON 数据", desc: "保留原始结构", icon: Braces },
]

interface DownloadPanelProps {
  selected?: SubtitleItem | null
  selectedLanguage?: string
  items?: SubtitleItem[]
}

export function DownloadPanel({ selected, selectedLanguage, items = [] }: DownloadPanelProps) {
  const [scope, setScope] = useState<DownloadScope>("current")
  const [downloadedCount, setDownloadedCount] = useState(0)
  const successful = useMemo(() => items.filter((item) => item.status === "success"), [items])
  const currentVariant = selected ? findVariant(selected, selectedLanguage) : undefined
  const targets = useMemo(
    () => getDownloadTargets({ scope, items: successful, selected, currentVariant }),
    [currentVariant, scope, selected, successful],
  )

  const scopes: { value: DownloadScope; label: string; count: number; disabled: boolean }[] = [
    { value: "current", label: "当前语言", count: currentVariant ? 1 : 0, disabled: !currentVariant },
    {
      value: "video",
      label: "当前视频",
      count: selected?.status === "success" ? selected.subtitles?.length ?? 0 : 0,
      disabled: selected?.status !== "success",
    },
    {
      value: "all",
      label: "全部字幕",
      count: successful.reduce((count, item) => count + (item.subtitles?.length ?? 0), 0),
      disabled: successful.length === 0,
    },
  ]

  const handleDownload = (format: FormatType) => {
    for (const target of targets) {
      const output = buildOutput(target.variant, format)
      downloadFile(
        `${buildSubtitleFileStem(target.item)}.${safeFileName(target.variant.language)}.${format}`,
        output,
        format,
      )
    }
    setDownloadedCount(targets.length)
    window.setTimeout(() => setDownloadedCount(0), 1800)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted/70 p-1">
        {scopes.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => {
              setScope(item.value)
              setDownloadedCount(0)
            }}
            disabled={item.disabled}
            className={`rounded-lg px-2 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-35 ${
              scope === item.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="block truncate">{item.label}</span>
            <span className="mt-0.5 block text-[10px] font-normal opacity-70">{item.count} 个文件</span>
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {formats.map((format) => {
          const Icon = format.icon
          return (
            <Button
              key={format.type}
              type="button"
              onClick={() => handleDownload(format.type)}
              disabled={targets.length === 0}
              variant="outline"
              className="h-auto justify-start rounded-xl px-3 py-3 text-left"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold">{format.label}</span>
                <span className="block truncate text-[10px] font-normal text-muted-foreground">{format.desc}</span>
              </span>
              <Download className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          )
        })}
      </div>

      {downloadedCount > 0 && (
        <div className="text-[11px]" aria-live="polite">
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            已生成 {downloadedCount} 个文件
          </span>
        </div>
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
  if (scope === "current") {
    return selected && currentVariant ? [{ item: selected, variant: currentVariant }] : []
  }

  const sourceItems = scope === "video" && selected ? [selected] : items
  return sourceItems.flatMap((item) => (item.subtitles ?? []).map((variant) => ({ item, variant })))
}

function buildOutput(variant: SubtitleVariant, format: FormatType): string {
  if (format === "txt") return variant.content
  if (format === "srt") return variant.srt ?? ""
  return variant.rawJson ?? JSON.stringify({ language: variant.language, text: variant.content }, null, 2)
}

function downloadFile(fileName: string, content: string, format: FormatType) {
  const mimeType = format === "json" ? "application/json" : "text/plain"
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
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

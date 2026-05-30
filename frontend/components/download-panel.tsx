"use client"

import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { SubtitleItem, SubtitleVariant } from "@/components/subtitle-list"

type FormatType = "txt" | "srt" | "json"
type DownloadScope = "current" | "video" | "all"

const formats: { type: FormatType; label: string; desc: string }[] = [
  { type: "txt", label: "TXT", desc: "编辑后的纯文本" },
  { type: "srt", label: "SRT", desc: "原始时间轴" },
  { type: "json", label: "JSON", desc: "原始字幕数据" },
]

interface DownloadPanelProps {
  selected?: SubtitleItem | null
  selectedLanguage?: string
  editedContent?: string
  items?: SubtitleItem[]
}

export function DownloadPanel({ selected, selectedLanguage, editedContent, items = [] }: DownloadPanelProps) {
  const successful = items.filter((item) => item.status === "success")
  const currentVariant = selected ? findVariant(selected, selectedLanguage) : undefined
  const successfulVariantCount = successful.reduce((count, item) => count + (item.subtitles?.length ?? 0), 0)

  const handleDownload = (format: FormatType, scope: DownloadScope) => {
    const targets = getDownloadTargets({
      scope,
      items: successful,
      selected,
      currentVariant,
      editedContent,
    })
    for (const target of targets) {
      const output = buildOutput(target.variant, format, target.editedContent)
      if (!output) continue
      download(`${safeFileName(target.item.bvid)}.${safeFileName(target.variant.language)}.${format}`, output)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-muted-foreground mb-2">当前语言</p>
        <div className="grid grid-cols-3 gap-2">
          {formats.map((format) => (
            <Button
              key={format.type}
              onClick={() => handleDownload(format.type, "current")}
              disabled={!currentVariant}
              variant="outline"
              size="sm"
              className="h-auto py-2 px-3 flex flex-col items-start gap-0.5"
            >
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Download className="h-3 w-3" />
                {format.label}
              </span>
              <span className="text-xs text-muted-foreground font-normal">{format.desc}</span>
            </Button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-2">当前视频全部语言</p>
        <div className="grid grid-cols-3 gap-2">
          {formats.map((format) => (
            <Button
              key={format.type}
              onClick={() => handleDownload(format.type, "video")}
              disabled={!selected || selected.status !== "success"}
              variant="secondary"
              size="sm"
            >
              {format.label}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-2">全部成功字幕</p>
        <div className="grid grid-cols-3 gap-2">
          {formats.map((format) => (
            <Button
              key={format.type}
              onClick={() => handleDownload(format.type, "all")}
              disabled={successfulVariantCount === 0}
              variant="secondary"
              size="sm"
            >
              {format.label}
            </Button>
          ))}
        </div>
      </div>
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
  editedContent,
}: {
  scope: DownloadScope
  items: SubtitleItem[]
  selected?: SubtitleItem | null
  currentVariant?: SubtitleVariant
  editedContent?: string
}) {
  if (scope === "current") {
    return selected && currentVariant ? [{ item: selected, variant: currentVariant, editedContent }] : []
  }

  const sourceItems = scope === "video" && selected ? [selected] : items
  return sourceItems.flatMap((item) =>
    (item.subtitles ?? []).map((variant) => ({
      item,
      variant,
      editedContent: item.id === selected?.id && variant.language === currentVariant?.language ? editedContent : undefined,
    })),
  )
}

function buildOutput(variant: SubtitleVariant, format: FormatType, editedContent?: string): string {
  if (format === "txt") {
    return editedContent ?? variant.content ?? ""
  }
  if (format === "srt") {
    return variant.srt ?? ""
  }
  return variant.rawJson ?? JSON.stringify({ language: variant.language, text: variant.content ?? "" }, null, 2)
}

function download(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function safeFileName(value: string): string {
  const match = value.match(/BV[0-9A-Za-z]{10}/)
  return (match ? match[0] : value).replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80) || "bili-ai-sub"
}

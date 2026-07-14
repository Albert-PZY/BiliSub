"use client"

import { useMemo, useState } from "react"
import { ChevronDown, Languages, Link2, Plus, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { type SubtitleLanguageMode, type VideoSource } from "@/lib/local-api"
import { MAX_VIDEO_SOURCES } from "@/lib/limits"

export type { SubtitleLanguageMode, VideoSource } from "@/lib/local-api"

const languageOptions: { value: SubtitleLanguageMode; label: string }[] = [
  { value: "all", label: "全部可用语言" },
  { value: "zh-Hans", label: "简体中文" },
  { value: "zh-Hant", label: "繁体中文" },
  { value: "en", label: "英语" },
  { value: "ja", label: "日语" },
  { value: "ko", label: "韩语" },
]

export function VideoInput({
  onSubmit,
  disabled,
}: {
  onSubmit?: (videos: VideoSource[], language: SubtitleLanguageMode) => void
  disabled?: boolean
}) {
  const [input, setInput] = useState("")
  const [videos, setVideos] = useState<VideoSource[]>([])
  const [language, setLanguage] = useState<SubtitleLanguageMode>("all")
  const [error, setError] = useState("")
  const pendingSources = useMemo(() => parseVideoSources(input), [input])
  const combinedCount = new Set([...videos.map((video) => video.url), ...pendingSources]).size

  const mergeInput = (): VideoSource[] | null => {
    const merged = new Map(videos.map((video) => [video.url, video]))
    for (const url of pendingSources) {
      if (!merged.has(url)) merged.set(url, { id: crypto.randomUUID(), url })
    }

    if (merged.size > MAX_VIDEO_SOURCES) {
      setError(`单次最多处理 ${MAX_VIDEO_SOURCES} 个视频，请分批操作`)
      return null
    }
    setError("")
    return [...merged.values()]
  }

  const handleAdd = () => {
    if (pendingSources.length === 0) return
    const merged = mergeInput()
    if (!merged) return
    setVideos(merged)
    setInput("")
  }

  const handleSubmit = () => {
    const merged = mergeInput()
    if (!merged?.length) return
    setVideos(merged)
    setInput("")
    onSubmit?.(merged, language)
  }

  const handleRemove = (id: string) => {
    setVideos((previous) => previous.filter((video) => video.id !== id))
    setError("")
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="video-sources" className="text-xs font-medium text-foreground">
          视频链接或 BV 号
        </label>
        <textarea
          id="video-sources"
          value={input}
          onChange={(event) => {
            setInput(event.target.value)
            setError("")
          }}
          placeholder={"BV1xx411c7mD\nhttps://www.bilibili.com/video/BV..."}
          className="min-h-24 w-full resize-y rounded-xl border border-border bg-background/80 px-3 py-2.5 text-sm leading-relaxed shadow-inner outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
          disabled={disabled}
          maxLength={20_000}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground">支持换行、逗号分隔，会自动去重</p>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={pendingSources.length === 0 || disabled}
            size="sm"
            variant="secondary"
          >
            <Plus className="h-3.5 w-3.5" />
            加入列表
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="subtitle-language" className="text-xs font-medium text-foreground">
          字幕语言
        </label>
        <div className="relative">
          <Languages className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <select
            id="subtitle-language"
            value={language}
            onChange={(event) => setLanguage(event.target.value as SubtitleLanguageMode)}
            disabled={disabled}
            className="h-10 w-full appearance-none rounded-xl border border-border bg-background pl-9 pr-9 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      {videos.length > 0 && (
        <div className="space-y-2 rounded-xl bg-muted/55 p-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-foreground">待处理 {videos.length} 个</span>
            <button
              type="button"
              onClick={() => setVideos([])}
              disabled={disabled}
              className="text-xs text-muted-foreground transition hover:text-destructive disabled:opacity-50"
            >
              清空
            </button>
          </div>
          <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
            {videos.map((video, index) => (
              <div key={video.id} className="group flex items-center gap-2 rounded-lg bg-background/80 px-2.5 py-2 text-sm">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-primary/10 text-[10px] font-semibold text-primary">
                  {index + 1}
                </span>
                <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-foreground/80" title={video.url}>{video.url}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(video.id)}
                  disabled={disabled}
                  className="rounded p-1 text-muted-foreground opacity-70 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 disabled:opacity-40"
                  aria-label={`移除第 ${index + 1} 个视频`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || combinedCount === 0}
        className="w-full"
      >
        <Sparkles className="h-4 w-4" />
        解析并获取字幕
        {combinedCount > 0 && <span className="rounded bg-primary-foreground/15 px-1.5 py-0.5 text-[10px]">{combinedCount}</span>}
      </Button>
    </div>
  )
}

function parseVideoSources(text: string): string[] {
  const urls = text.match(/https?:\/\/[^\s,，;；]+/gi) ?? []
  const bvids = text.match(/BV[0-9A-Za-z]{10}/g) ?? []
  const fallback = text.split(/[\s,，;；]+/).map((item) => item.trim()).filter(Boolean)
  const candidates = urls.length > 0 || bvids.length > 0 ? [...urls, ...bvids] : fallback
  return [...new Set(candidates.map((candidate) => candidate.match(/BV[0-9A-Za-z]{10}/)?.[0] ?? candidate))]
}

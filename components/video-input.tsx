"use client"

import { useState } from "react"
import { Check, ChevronDown, Languages, Plus, Trash2, Link } from "lucide-react"
import { Button } from "@/components/ui/button"

export type VideoSource = {
  id: string
  url: string
}

export type SubtitleLanguageMode = "all" | "zh-Hans" | "zh-Hant" | "en" | "ja" | "ko"

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
  const [languageOpen, setLanguageOpen] = useState(false)
  const selectedLanguageOption = languageOptions.find((option) => option.value === language) ?? languageOptions[0]

  const parseUrls = (text: string): string[] => {
    return [
      ...new Set(
        text
          .split(/[\n,]/)
          .map((line) => line.trim())
          .filter(Boolean),
      ),
    ]
  }

  const handleAdd = () => {
    const urls = parseUrls(input)
    if (urls.length === 0) return

    const newVideos = urls.map((url) => ({
      id: crypto.randomUUID(),
      url,
    }))

    setVideos((prev) => [...prev, ...newVideos])
    setInput("")
  }

  const handleRemove = (id: string) => {
    setVideos((prev) => prev.filter((v) => v.id !== id))
  }

  const handleClear = () => {
    setVideos([])
  }

  const handleSubmit = () => {
    if (videos.length > 0) {
      onSubmit?.(videos, language)
    }
  }

  const handleSelectLanguage = (value: SubtitleLanguageMode) => {
    setLanguage(value)
    setLanguageOpen(false)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入B站视频链接或BV号，支持多个（每行一个或逗号分隔）"
          className="w-full h-24 px-3 py-2 text-sm bg-input border border-border rounded-md resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          disabled={disabled}
        />
        <div className="flex justify-end">
          <Button onClick={handleAdd} disabled={!input.trim() || disabled} size="sm" variant="secondary">
            <Plus className="h-4 w-4 mr-1" />
            添加
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="subtitle-language" className="text-xs text-muted-foreground">
          AI字幕语言
        </label>
        <div
          className="relative"
          onBlur={(event) => {
            const nextTarget = event.relatedTarget as Node | null
            if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
              setLanguageOpen(false)
            }
          }}
        >
          <button
            id="subtitle-language"
            type="button"
            aria-haspopup="listbox"
            aria-expanded={languageOpen}
            onClick={() => setLanguageOpen((open) => !open)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setLanguageOpen(false)
            }}
            disabled={disabled}
            className="relative flex h-10 w-full items-center rounded-md border border-border bg-background pl-9 pr-9 text-left text-sm text-foreground shadow-xs transition-colors hover:bg-muted/40 focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Languages className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <span className="truncate">{selectedLanguageOption.label}</span>
            <ChevronDown
              className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-transform ${
                languageOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {languageOpen && (
            <div
              role="listbox"
              aria-label="AI字幕语言"
              className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover p-1 shadow-lg"
            >
              {languageOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === language}
                  onClick={() => handleSelectLanguage(option.value)}
                  className={`flex w-full items-center justify-between rounded px-2.5 py-2 text-left text-sm transition-colors ${
                    option.value === language
                      ? "bg-accent/10 text-foreground"
                      : "text-foreground hover:bg-muted/60"
                  }`}
                >
                  <span>{option.label}</span>
                  {option.value === language && <Check className="h-3.5 w-3.5 text-accent" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {videos.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">已添加 {videos.length} 个视频</span>
            <Button onClick={handleClear} variant="ghost" size="sm" className="text-xs text-muted-foreground h-6 px-2">
              清空
            </Button>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {videos.map((video) => (
              <div
                key={video.id}
                className="flex items-center gap-2 px-2 py-1.5 bg-muted/50 rounded text-sm group"
              >
                <Link className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="flex-1 truncate text-foreground/80">{video.url}</span>
                <button
                  onClick={() => handleRemove(video.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <Button onClick={handleSubmit} disabled={disabled} className="w-full" size="sm">
            解析视频
          </Button>
        </div>
      )}
    </div>
  )
}

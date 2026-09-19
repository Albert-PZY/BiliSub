'use client'

import { useMemo, useState } from "react"
import { ChevronDown, FileSearch, Languages, Link2, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { SubtitleLanguageMode, VideoSource } from "@/lib/local-api"
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

  return (
    <div className="video-form">
      <div className="form-field">
        <label htmlFor="video-sources" className="form-label">视频链接或 BV 号</label>
        <textarea
          id="video-sources"
          value={input}
          onChange={(event) => {
            setInput(event.target.value)
            setError("")
          }}
          placeholder="BV1xx411c7mD 或 https://www.bilibili.com/video/BV..."
          className="textarea-input"
          disabled={disabled}
          maxLength={20_000}
          aria-describedby="video-sources-hint"
        />
        <div className="field-row">
          <span id="video-sources-hint">换行或逗号分隔，自动去重</span>
          <Button type="button" onClick={handleAdd} disabled={pendingSources.length === 0 || disabled} size="sm" variant="secondary">
            <Plus size={14} aria-hidden="true" />加入列表
          </Button>
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="subtitle-language" className="form-label">字幕语言</label>
        <div className="select-wrap">
          <Languages size={15} aria-hidden="true" />
          <select
            id="subtitle-language"
            value={language}
            onChange={(event) => setLanguage(event.target.value as SubtitleLanguageMode)}
            disabled={disabled}
            className="select-input"
          >
            {languageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <ChevronDown size={15} aria-hidden="true" />
        </div>
      </div>

      {videos.length > 0 && (
        <div className="pending-list-wrap">
          <div className="pending-list-head">
            <p className="pending-list-title">待处理 {videos.length} 个</p>
            <button type="button" className="text-button text-button--danger" onClick={() => setVideos([])} disabled={disabled}>清空</button>
          </div>
          <div className="pending-list">
            {videos.map((video, index) => (
              <div key={video.id} className="pending-item">
                <span className="pending-item__index">{index + 1}</span>
                <Link2 size={13} aria-hidden="true" />
                <span className="pending-item__source" title={video.url}>{video.url}</span>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => {
                    setVideos((current) => current.filter((item) => item.id !== video.id))
                    setError("")
                  }}
                  disabled={disabled}
                  aria-label={`移除第 ${index + 1} 个视频`}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}

      <Button type="button" onClick={handleSubmit} disabled={disabled || combinedCount === 0} size="lg">
        <FileSearch size={16} aria-hidden="true" />
        解析并获取字幕{combinedCount > 0 ? ` · ${combinedCount}` : ""}
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

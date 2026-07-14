"use client"

import { useEffect, useState } from "react"
import { Check, Copy, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SubtitleEditorProps {
  title?: string
  content: string
  originalContent: string
  onChange: (content: string) => void
  onReset: () => void
}

export function SubtitleEditor({ title, content, originalContent, onChange, onReset }: SubtitleEditorProps) {
  const [copied, setCopied] = useState(false)
  const hasChanges = content !== originalContent
  const lineCount = content ? content.split(/\r?\n/).length : 0

  useEffect(() => {
    setCopied(false)
  }, [content])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex flex-col gap-3 border-b border-border/70 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {title && <h3 className="truncate text-sm font-semibold text-foreground" title={title}>{title}</h3>}
          <p className="mt-1 text-[11px] text-muted-foreground">
            {content.length.toLocaleString("zh-CN")} 字符 · {lineCount.toLocaleString("zh-CN")} 行
            {hasChanges ? " · 修改已自动保存在本页" : " · 原始内容"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {hasChanges && (
            <Button type="button" onClick={onReset} variant="ghost" size="sm">
              <RotateCcw className="h-3.5 w-3.5" />
              恢复原文
            </Button>
          )}
          <Button type="button" onClick={handleCopy} variant="outline" size="sm" disabled={!content}>
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "已复制" : "复制"}
          </Button>
        </div>
      </div>

      <textarea
        value={content}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[340px] w-full flex-1 resize-y rounded-xl border border-border bg-background/75 px-4 py-3 font-mono text-[13px] leading-7 text-foreground shadow-inner outline-none transition placeholder:text-muted-foreground focus:border-primary/50 focus:ring-4 focus:ring-primary/10 sm:min-h-[430px]"
        placeholder="字幕内容会显示在这里…"
        spellCheck={false}
        aria-label={title ? `编辑 ${title}` : "编辑字幕"}
      />
    </div>
  )
}

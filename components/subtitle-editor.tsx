'use client'

import { useEffect, useRef, useState } from "react"
import { Check, Copy, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"

type SubtitleEditorProps = {
  title?: string
  content: string
  originalContent: string
  onChange: (content: string) => void
  onReset: () => void
}

export function SubtitleEditor({ title, content, originalContent, onChange, onReset }: SubtitleEditorProps) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const copiedTimerRef = useRef<number | null>(null)
  const hasChanges = content !== originalContent
  const lineCount = content ? content.split(/\r?\n/).length : 0

  useEffect(() => {
    setCopied(false)
    if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
  }, [content])

  useEffect(() => () => {
    if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
  }, [])

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(content)
        } catch {
          copyWithExecCommand(content)
        }
      } else {
        copyWithExecCommand(content)
      }
      setCopied(true)
      toast("已复制字幕内容", "success")
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
      toast("复制失败，请手动选择字幕内容后复制", "error")
    }
  }

  return (
    <div className="editor-content">
      <div className="editor-tools">
        <div className="editor-tools__meta">
          {title && <h3 className="editor-tools__title" title={title}>{title}</h3>}
          <p className="editor-tools__stats">
            {content.length.toLocaleString("zh-CN")} 字符 · {lineCount.toLocaleString("zh-CN")} 行
            {hasChanges ? " · 当前内容已修改" : " · 原始内容"}
          </p>
        </div>
        <div className="editor-tools__actions">
          {hasChanges && (
            <Button type="button" onClick={onReset} variant="ghost" size="sm">
              <RotateCcw size={14} aria-hidden="true" />恢复原文
            </Button>
          )}
          <Button type="button" onClick={handleCopy} variant="outline" size="sm" disabled={!content}>
            {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            {copied ? "已复制" : "复制"}
          </Button>
        </div>
      </div>

      <textarea
        value={content}
        onChange={(event) => onChange(event.target.value)}
        className="subtitle-textarea"
        placeholder="字幕内容会显示在这里…"
        spellCheck={false}
        aria-label={title ? `编辑 ${title}` : "编辑字幕"}
      />
    </div>
  )
}

function copyWithExecCommand(content: string): void {
  const textarea = document.createElement("textarea")
  textarea.value = content
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand("copy")
  textarea.remove()
  if (!copied) throw new Error("execCommand copy failed")
}

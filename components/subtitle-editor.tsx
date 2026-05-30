"use client"

import { useState, useEffect } from "react"
import { Save, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SubtitleEditorProps {
  title?: string
  content: string
  onSave?: (content: string) => void
  onChange?: (content: string) => void
}

export function SubtitleEditor({ title, content, onSave, onChange }: SubtitleEditorProps) {
  const [value, setValue] = useState(content)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    setValue(content)
    setHasChanges(false)
  }, [content])

  const handleChange = (newValue: string) => {
    setValue(newValue)
    setHasChanges(newValue !== content)
    onChange?.(newValue)
  }

  const handleSave = () => {
    onSave?.(value)
    setHasChanges(false)
  }

  const handleReset = () => {
    setValue(content)
    setHasChanges(false)
  }

  return (
    <div className="flex flex-col h-full">
      {title && (
        <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
          <h3 className="text-sm font-medium text-foreground truncate pr-4">{title}</h3>
          <div className="flex items-center gap-2 flex-shrink-0">
            {hasChanges && (
              <Button onClick={handleReset} variant="ghost" size="sm" className="h-7 px-2 text-xs">
                <RotateCcw className="h-3 w-3 mr-1" />
                重置
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={!hasChanges}
              size="sm"
              className="h-7 px-3 text-xs"
            >
              <Save className="h-3 w-3 mr-1" />
              保存
            </Button>
          </div>
        </div>
      )}
      <div className="flex-1 min-h-0">
        <textarea
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full h-full min-h-[300px] px-3 py-2 text-sm bg-input border border-border rounded-md resize-none font-mono leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="选择一个视频以编辑字幕..."
        />
      </div>
      {hasChanges && (
        <p className="text-xs text-accent mt-2">* 有未保存的更改</p>
      )}
    </div>
  )
}

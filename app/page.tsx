"use client"

import { useCallback, useState, type ReactNode } from "react"
import {
  Check,
  FilePenLine,
  Github,
  Languages,
  Loader2,
  LockKeyhole,
  Sparkles,
  WandSparkles,
  Zap,
} from "lucide-react"
import { DownloadPanel } from "@/components/download-panel"
import { QrLogin } from "@/components/qr-login"
import { SubtitleEditor } from "@/components/subtitle-editor"
import { SubtitleList } from "@/components/subtitle-list"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { VideoInput } from "@/components/video-input"
import { VideoPageSelector } from "@/components/video-page-selector"
import { useSubtitleWorkspace } from "@/hooks/use-subtitle-workspace"

const GITHUB_REPOSITORY_URL = "https://github.com/Albert-PZY/BiliSub"

export default function Home() {
  const workspace = useSubtitleWorkspace()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const { resetWorkspace } = workspace

  const handleLogout = useCallback(() => {
    setIsLoggedIn(false)
    resetWorkspace()
  }, [resetWorkspace])

  const selectedId = workspace.selectedSubtitle?.id

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[520px] bg-[radial-gradient(circle_at_18%_10%,color-mix(in_oklab,var(--primary)_16%,transparent),transparent_42%),radial-gradient(circle_at_84%_4%,color-mix(in_oklab,var(--brand-pink)_13%,transparent),transparent_36%)]" />

      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <a href="#top" className="flex items-center gap-2.5" aria-label="返回页面顶部">
            <img src="/icon.svg" width="34" height="34" alt="" className="rounded-xl shadow-sm" />
            <div>
              <p className="text-sm font-bold tracking-tight text-foreground">BiliAISub</p>
              <p className="hidden text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:block">Subtitle workspace</p>
            </div>
          </a>

          <div className="flex items-center gap-1.5">
            <span className={`mr-1 hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] sm:inline-flex ${
              isLoggedIn
                ? "border-emerald-500/20 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300"
                : "border-border bg-card/70 text-muted-foreground"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isLoggedIn ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
              {isLoggedIn ? "B 站已连接" : "等待登录"}
            </span>
            <Button variant="ghost" size="icon-sm" asChild>
              <a href={GITHUB_REPOSITORY_URL} target="_blank" rel="noreferrer" aria-label="打开 GitHub 仓库">
                <Github className="h-4 w-4" />
              </a>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div id="top" className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
        <section className="mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-card/75 px-3 py-1.5 text-xs text-primary shadow-sm backdrop-blur">
            <WandSparkles className="h-3.5 w-3.5" />
            B 站官方 AI 字幕工作台
          </div>
          <h1 className="text-balance text-3xl font-bold tracking-[-0.035em] text-foreground sm:text-5xl">
            <span className="block sm:inline">把视频字幕，</span><span className="brand-gradient-text">变成真正可用的文本</span>
          </h1>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <FeaturePill icon={<Zap />} label="逐条流式返回" />
            <FeaturePill icon={<Languages />} label="多语言获取" />
            <FeaturePill icon={<LockKeyhole />} label="加密本机会话" />
          </div>
        </section>

        <WorkflowRail
          isLoggedIn={isLoggedIn}
          hasVideos={workspace.resolvedVideos.length > 0}
          hasSubtitles={workspace.subtitles.length > 0}
          hasSelection={Boolean(workspace.selectedVariant)}
        />

        <section className="mt-6 grid items-start gap-5 lg:grid-cols-[350px_minmax(0,1fr)] xl:grid-cols-[390px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <Panel>
              <PanelHeader step="01" title="连接账号" />
              <QrLogin onLoginSuccess={() => setIsLoggedIn(true)} onLogout={handleLogout} />
            </Panel>

            {isLoggedIn && (
              <Panel>
                <PanelHeader step="02" title="添加视频" description="可直接粘贴一批链接或 BV 号。" />
                <VideoInput onSubmit={workspace.resolveVideos} disabled={workspace.isBusy} />
              </Panel>
            )}

            {isLoggedIn && workspace.needsPageSelection && (
              <Panel>
                <VideoPageSelector
                  videos={workspace.resolvedVideos}
                  selectedIds={workspace.selectedPageIds}
                  disabled={workspace.isBusy}
                  onTogglePage={workspace.togglePage}
                  onSelectAll={workspace.selectAllPages}
                  onClear={workspace.clearSelectedPages}
                  onSubmit={workspace.fetchSelectedPages}
                />
              </Panel>
            )}

            {workspace.subtitles.length > 0 && (
              <Panel>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">字幕任务</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      成功 {workspace.successCount}/{workspace.subtitles.length}
                    </p>
                  </div>
                  {workspace.isFetching && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] text-primary">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      流式获取中
                    </span>
                  )}
                </div>
                <SubtitleList items={workspace.subtitles} selectedId={selectedId ?? undefined} onSelect={workspace.selectSubtitle} />
              </Panel>
            )}
          </aside>

          <div className="min-w-0 space-y-4">
            {workspace.isResolving && (
              <div className="flex items-center gap-3 rounded-2xl border border-primary/15 bg-primary/8 px-4 py-3 text-sm text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在解析视频信息与分 P，请稍候…
              </div>
            )}

            <Panel className="min-h-[460px] sm:min-h-[590px]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <FilePenLine className="h-4 w-4 text-primary" />
                    字幕编辑器
                  </p>
                </div>
                {workspace.selectedVariant && (
                  <span className="hidden rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground sm:inline-flex">
                    {workspace.selectedVariant.language}
                  </span>
                )}
              </div>

              {workspace.selectedSubtitle && workspace.selectedVariant ? (
                <div className="flex min-h-[390px] flex-col sm:min-h-[510px]">
                  <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="字幕语言">
                    {workspace.selectedSubtitle.subtitles?.map((variant) => {
                      const isActive = workspace.selectedLanguage === variant.language
                      const isEdited = variant.content !== variant.originalContent
                      return (
                        <button
                          key={variant.language}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          onClick={() => workspace.selectLanguage(variant.language)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                            isActive
                              ? "border-primary/25 bg-primary/10 text-primary"
                              : "border-border bg-background text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {variant.label || variant.language}
                          {isEdited && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="已编辑" />}
                        </button>
                      )
                    })}
                  </div>
                  <SubtitleEditor
                    title={`${workspace.selectedSubtitle.title} · ${workspace.selectedVariant.label || workspace.selectedVariant.language}`}
                    content={workspace.selectedVariant.content}
                    originalContent={workspace.selectedVariant.originalContent}
                    onChange={workspace.changeSelectedContent}
                    onReset={workspace.resetSelectedContent}
                  />
                </div>
              ) : (
                <EditorEmptyState
                  isLoggedIn={isLoggedIn}
                  hasSubtitles={workspace.subtitles.length > 0}
                  isBusy={workspace.isBusy}
                />
              )}
            </Panel>

            <Panel>
              <PanelHeader
                title="导出字幕"
                icon={<Sparkles className="h-4 w-4" />}
              />
              <DownloadPanel
                selected={workspace.selectedSubtitle}
                selectedLanguage={workspace.selectedLanguage}
                items={workspace.subtitles}
              />
            </Panel>
          </div>
        </section>
      </div>

      <footer className="relative z-10 border-t border-border/70 bg-card/35">
        <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-5 text-center text-xs text-muted-foreground sm:px-6">
          <span>BiliAISub · 字幕内容来自 B 站官方 AI 字幕</span>
        </div>
      </footer>
    </main>
  )
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border/75 bg-card/88 p-4 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.45)] backdrop-blur sm:p-5 ${className}`}>{children}</div>
}

function PanelHeader({
  step,
  title,
  description,
  icon,
}: {
  step?: string
  title: string
  description?: string
  icon?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="grid h-8 min-w-8 place-items-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary">
        {icon ?? step}
      </span>
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>}
      </div>
    </div>
  )
}

function FeaturePill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card/70 px-3 py-1.5 text-xs text-muted-foreground shadow-sm [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:text-primary">
      {icon}
      {label}
    </span>
  )
}

function WorkflowRail({
  isLoggedIn,
  hasVideos,
  hasSubtitles,
  hasSelection,
}: {
  isLoggedIn: boolean
  hasVideos: boolean
  hasSubtitles: boolean
  hasSelection: boolean
}) {
  const steps = [
    { label: "扫码登录", complete: isLoggedIn },
    { label: "解析视频", complete: hasVideos },
    { label: "获取字幕", complete: hasSubtitles },
    { label: "编辑导出", complete: hasSelection },
  ]

  return (
    <ol className="mx-auto mt-9 grid max-w-3xl grid-cols-4 rounded-2xl border border-border/70 bg-card/70 p-2 shadow-sm backdrop-blur">
      {steps.map((step, index) => (
        <li key={step.label} className="relative flex flex-col items-center gap-1.5 px-1 py-2 text-center">
          {index > 0 && <span className="absolute right-1/2 top-[19px] -z-10 h-px w-full bg-border" />}
          <span className={`grid h-6 w-6 place-items-center rounded-full border text-[10px] font-bold ${
            step.complete
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-muted-foreground"
          }`}>
            {step.complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
          </span>
          <span className="text-[10px] text-muted-foreground sm:text-xs">{step.label}</span>
        </li>
      ))}
    </ol>
  )
}

function EditorEmptyState({
  isLoggedIn,
  hasSubtitles,
  isBusy,
}: {
  isLoggedIn: boolean
  hasSubtitles: boolean
  isBusy: boolean
}) {
  const message = isBusy
    ? "字幕正在路上，获取到第一条后会自动打开"
    : !isLoggedIn
      ? ""
      : hasSubtitles
        ? "从左侧选择一条成功获取的字幕"
        : "添加视频后，字幕会在这里逐条出现"

  return (
    <div className="grid min-h-[360px] place-items-center rounded-2xl border border-dashed border-border bg-muted/25 px-6 text-center sm:min-h-[490px]">
      <div className="max-w-xs">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
          {isBusy ? <Loader2 className="h-6 w-6 animate-spin" /> : <FilePenLine className="h-6 w-6" />}
        </div>
        <p className="mt-4 text-sm font-medium text-foreground">准备好后，从这里开始校对</p>
        {message && <p className="mt-2 text-xs leading-5 text-muted-foreground">{message}</p>}
      </div>
    </div>
  )
}

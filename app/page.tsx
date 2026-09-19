'use client'

/*
 * BiliAISub 工作台。应用是一个单一 Next.js 部署：
 * 前端页面与 /api 路由同源，因此不需要 API 域名、静态 base path
 * 或跨域会话令牌。工作区规格页由 app/specs/page.tsx 提供。
 */

import { useCallback, useState, type KeyboardEvent, type ReactNode } from "react"
import { Download, FilePenLine, Info, Loader2, Github, Sparkles } from "lucide-react"
import { DownloadPanel } from "@/components/download-panel"
import { QrLogin, type AuthStatus } from "@/components/qr-login"
import { SubtitleEditor } from "@/components/subtitle-editor"
import { SubtitleList } from "@/components/subtitle-list"
import { ThemeToggle } from "@/components/theme-toggle"
import { VideoInput } from "@/components/video-input"
import { VideoPageSelector } from "@/components/video-page-selector"
import { useSubtitleWorkspace } from "@/hooks/use-subtitle-workspace"
import { MAX_SUBTITLE_PAGES, MAX_VIDEO_SOURCES } from "@/lib/limits"
import type { Account } from "@/lib/local-api"

const GITHUB_REPOSITORY_URL = "https://github.com/Albert-PZY/BiliSub"

type AuthBadgeState = {
  status: AuthStatus
  account: Account | null
}

export default function Home() {
  const [auth, setAuth] = useState<AuthBadgeState>({ status: "checking", account: null })
  const [authExpiredKey, setAuthExpiredKey] = useState(0)
  const handleAuthChange = useCallback((status: AuthStatus, account: Account | null) => {
    setAuth({ status, account })
  }, [])
  const handleAuthExpired = useCallback(() => {
    setAuth({ status: "expired", account: null })
    setAuthExpiredKey((value) => value + 1)
  }, [])
  const workspace = useSubtitleWorkspace({ onAuthExpired: handleAuthExpired })
  const { resetWorkspace } = workspace
  const isLoggedIn = auth.status === "active" && Boolean(auth.account)

  const handleLogout = useCallback(() => {
    setAuth({ status: "missing", account: null })
    resetWorkspace()
  }, [resetWorkspace])

  const selectedId = workspace.selectedSubtitle?.id
  const languagePanelId = workspace.selectedSubtitle ? `subtitle-panel-${safeDomId(workspace.selectedSubtitle.id)}` : ""
  const selectedLanguageIndex = Math.max(
    0,
    workspace.selectedSubtitle?.subtitles?.findIndex((variant) => variant.language === workspace.selectedLanguage) ?? 0,
  )

  const logPanel = (
    <aside className="workbench__rail" aria-label="账号与任务">
      <div className="sidebar-surface">
        <SidebarBlock step="01" title="连接账号" description="扫码后由独立 API 加密处理登录态。">
          <QrLogin authExpiredKey={authExpiredKey} onStatusChange={handleAuthChange} onLogout={handleLogout} />
        </SidebarBlock>

        {workspace.needsPageSelection && (
          <SidebarBlock step="02" title="选择分 P" description="单 P 会自动处理，多 P 由你决定范围。">
            <VideoPageSelector
              videos={workspace.resolvedVideos}
              selectedIds={workspace.selectedPageIds}
              disabled={workspace.isBusy}
              onTogglePage={workspace.togglePage}
              onSelectAll={workspace.selectAllPages}
              onClear={workspace.clearSelectedPages}
              onSubmit={workspace.fetchSelectedPages}
            />
          </SidebarBlock>
        )}

        {workspace.subtitles.length > 0 && (
          <SidebarBlock
            step={workspace.needsPageSelection ? "03" : "02"}
            title="字幕任务"
            description={`成功 ${workspace.successCount}/${workspace.taskCount} 个处理项`}
          >
            {workspace.isFetching && (
              <div className="task-list-head">
                <span className="task-list-meta">结果会逐条出现</span>
                <span className="live-status"><Loader2 size={14} className="spin" aria-hidden="true" />获取中</span>
              </div>
            )}
            <SubtitleList items={workspace.subtitles} selectedId={selectedId ?? undefined} onSelect={workspace.selectSubtitle} />
          </SidebarBlock>
        )}
      </div>

      <p className="rail-footnote">
        <Info size={14} aria-hidden="true" />字幕可用性取决于 B 站对具体视频返回的官方 AI 字幕。
      </p>
    </aside>
  )


  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace">跳到字幕工作区</a>

      <header className="app-header">
        <div className="header-inner">
          <a className="brand" href="#top" aria-label="返回页面顶部">
            <img className="brand-mark" src="/icon.svg" width="34" height="34" alt="" />
            <span className="brand-copy">
              <span className="brand-name">BiliAISub</span>
              <span className="brand-caption">Subtitle workspace</span>
            </span>
          </a>

          <div className="header-actions">
            <AuthStatusChip status={auth.status} account={auth.account} />
            <a className="header-link" href="/specs">规格</a>
            <a
              className="icon-button"
              href={GITHUB_REPOSITORY_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="打开 GitHub 仓库"
              title="GitHub 仓库"
            >
              <Github size={17} aria-hidden="true" />
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="top" className="page-frame">
        <div className="workbench">
          <section className="workbench__command" aria-labelledby="page-title">
            <div className="command-bar">
              <div className="command-bar__head">
                <h1 id="page-title" className="command-bar__title">
                  从视频链接到<span>可编辑字幕</span>
                </h1>
                <ul className="command-bar__meta" aria-label="工作区限制与格式">
                  <li>最多 {MAX_VIDEO_SOURCES} 个视频</li>
                  <li>最多 {MAX_SUBTITLE_PAGES} 个分 P</li>
                  <li>TXT / SRT / JSON</li>
                </ul>
              </div>

              {isLoggedIn ? (
                <VideoInput onSubmit={workspace.resolveVideos} disabled={workspace.isBusy} />
              ) : (
                <p className="section-note">
                  先在左侧连接 B 站账号，之后就能解析视频并按分 P 获取官方 AI 字幕。
                </p>
              )}
            </div>
          </section>

          {logPanel}

          <div className="workbench__stage" id="workspace">
            {workspace.isResolving && (
              <div className="stage-notice" role="status">
                <Loader2 size={16} className="spin" aria-hidden="true" />正在解析视频信息与分 P…
              </div>
            )}

            <section className="editor-surface surface" aria-labelledby="editor-title">
              <div className="editor-head">
                <div className="editor-heading">
                  <FilePenLine size={17} aria-hidden="true" />
                  <h2 id="editor-title" className="editor-title">字幕编辑器</h2>
                </div>
                {workspace.selectedVariant ? (
                  <span className="editor-language">{workspace.selectedVariant.language}</span>
                ) : (
                  <span className="editor-state">待选择字幕</span>
                )}
              </div>

              <div className="editor-body">
                {workspace.selectedSubtitle && workspace.selectedVariant ? (
                  <>
                    <div className="language-tabs" role="tablist" aria-label="字幕语言" aria-orientation="horizontal">
                      {workspace.selectedSubtitle.subtitles?.map((variant, index, variants) => {
                        const active = workspace.selectedLanguage === variant.language
                        const edited = variant.content !== variant.originalContent
                        const tabId = getLanguageTabId(variant.language, index)
                        return (
                          <button
                            key={`${variant.language}-${index}`}
                            id={tabId}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            aria-controls={languagePanelId}
                            tabIndex={active ? 0 : -1}
                            onClick={() => workspace.selectLanguage(variant.language)}
                            onKeyDown={(event) => moveLanguageTab(event, index, variants, workspace.selectLanguage)}
                            className={`language-tab${active ? " language-tab--active" : ""}`}
                          >
                            {variant.label || variant.language}
                            {edited && <span className="language-tab__edited" title="已编辑" aria-label="已编辑" />}
                          </button>
                        )
                      })}
                    </div>
                    <div
                      id={languagePanelId}
                      role="tabpanel"
                      aria-labelledby={getLanguageTabId(workspace.selectedLanguage, selectedLanguageIndex)}
                      tabIndex={0}
                    >
                      <SubtitleEditor
                        title={`${workspace.selectedSubtitle.title} · ${workspace.selectedVariant.label || workspace.selectedVariant.language}`}
                        content={workspace.selectedVariant.content}
                        originalContent={workspace.selectedVariant.originalContent}
                        onChange={workspace.changeSelectedContent}
                        onReset={workspace.resetSelectedContent}
                      />
                    </div>
                  </>
                ) : (
                  <EditorEmptyState
                    isLoggedIn={isLoggedIn}
                    hasSubtitles={workspace.subtitles.length > 0}
                    isBusy={workspace.isBusy}
                  />
                )}
              </div>
            </section>

            {workspace.selectedVariant && (
              <section className="export-surface surface" aria-labelledby="export-title">
                <div className="export-head">
                  <div className="export-heading">
                    <Download size={17} aria-hidden="true" />
                    <h2 id="export-title" className="export-title">导出字幕</h2>
                  </div>
                  <span className="editor-language">
                    <Sparkles size={12} aria-hidden="true" />{workspace.selectedVariant.label || workspace.selectedVariant.language}
                  </span>
                </div>
                <DownloadPanel
                  selected={workspace.selectedSubtitle}
                  selectedLanguage={workspace.selectedLanguage}
                  items={workspace.subtitles}
                />
              </section>
            )}
          </div>
        </div>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <span>BiliAISub · 字幕内容来自 B 站官方 AI 字幕</span>
          <nav className="footer-nav" aria-label="项目链接">
            <a className="footer-link" href="/specs">规格</a>
            <a className="footer-link" href={GITHUB_REPOSITORY_URL} target="_blank" rel="noreferrer">查看源代码</a>
          </nav>
        </div>
      </footer>
    </div>
  )
}

function AuthStatusChip({ status, account }: AuthBadgeState) {
  const text = status === "active"
    ? account?.uname || "B 站已连接"
    : status === "checking"
      ? "检查登录态"
      : status === "expired"
        ? "登录已失效"
        : "等待登录"
  const modifier = status === "active" ? " status-chip--active" : status === "checking" ? " status-chip--checking" : ""
  return (
    <span className={`status-chip${modifier}`} title={text} aria-label={text}>
      <span className="status-chip__dot" aria-hidden="true" />
      <span className="status-chip__label">{text}</span>
    </span>
  )
}

function SidebarBlock({
  step,
  title,
  description,
  className = "",
  children,
}: {
  step: string
  title: string
  description?: string
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`sidebar-block${className ? ` ${className}` : ""}`}>
      <div className="section-head">
        <span className="section-index" aria-hidden="true">{step}</span>
        <div className="section-head__body">
          <h2 className="section-title">{title}</h2>
          {description && <p className="section-note">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function EditorEmptyState({ isLoggedIn, hasSubtitles, isBusy }: { isLoggedIn: boolean; hasSubtitles: boolean; isBusy: boolean }) {
  const message = isBusy
    ? "获取到第一条字幕后会自动打开。"
    : !isLoggedIn
      ? "先在左侧连接 B 站账号，之后这里会显示抓取到的字幕。"
      : hasSubtitles
        ? "从左侧任务列表选择一条可用字幕。"
        : "添加视频后，字幕会在这里逐条出现。"
  const title = isBusy ? "正在读取字幕" : !isLoggedIn ? "等待连接账号" : "编辑区已准备好"

  return (
    <div className="editor-empty">
      <div>
        <div className="editor-empty__icon">
          {isBusy ? <Loader2 size={22} className="spin" aria-hidden="true" /> : <FilePenLine size={22} aria-hidden="true" />}
        </div>
        <p className="editor-empty__title">{title}</p>
        <p className="editor-empty__copy">{message}</p>
      </div>
    </div>
  )
}

function safeDomId(value: string): string {
  return Array.from(value).map((character) => {
    if (/[a-zA-Z0-9_-]/.test(character)) return character
    return `-${character.codePointAt(0)?.toString(16) ?? "x"}-`
  }).join("") || "item"
}

function getLanguageTabId(language: string, index: number): string {
  return `subtitle-tab-${safeDomId(language)}-${index}`
}

function moveLanguageTab(
  event: KeyboardEvent<HTMLButtonElement>,
  index: number,
  variants: ReadonlyArray<{ language: string }>,
  selectLanguage: (language: string) => void,
): void {
  if (variants.length === 0) return
  let nextIndex = index
  if (event.key === "ArrowRight") nextIndex = (index + 1) % variants.length
  else if (event.key === "ArrowLeft") nextIndex = (index - 1 + variants.length) % variants.length
  else if (event.key === "Home") nextIndex = 0
  else if (event.key === "End") nextIndex = variants.length - 1
  else return
  event.preventDefault()
  const next = variants[nextIndex]
  selectLanguage(next.language)
  document.getElementById(getLanguageTabId(next.language, nextIndex))?.focus()
}

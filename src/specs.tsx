import type { ReactNode } from "react"
import { CheckCircle2, Github, LockKeyhole, MonitorUp, ShieldCheck, Workflow } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { assetUrl } from "@/lib/assets"
import { MAX_SUBTITLE_PAGES, MAX_VIDEO_SOURCES } from "@/lib/limits"

const GITHUB_REPOSITORY_URL = "https://github.com/Albert-PZY/BiliSub"

const limits = [
  ["视频输入", `单批最多 ${MAX_VIDEO_SOURCES} 个`, "支持 BV 号、完整链接和 b23.tv 短链接"],
  ["字幕分 P", `单次最多 ${MAX_SUBTITLE_PAGES} 个`, "多 P 视频在解析后明确选择处理范围"],
  ["输出格式", "TXT / SRT / JSON", "按当前语言、当前视频或全部成功结果导出"],
]

const states = [
  ["连接账号", "扫码建立服务端加密会话", "未连接时命令栏只提示先登录"],
  ["解析视频", "校验输入并返回标题与分 P", "单 P 自动进入字幕请求"],
  ["流式获取", "按分 P 推送 NDJSON 结果", "已完成项不会被后续请求覆盖"],
  ["在线校对", "编辑当前语言内容", "可恢复原文，修改不会自动发送到 B 站"],
]

export function SpecsPage() {
  return (
    <div className="app-shell specs-shell">
      <header className="app-header">
        <div className="header-inner">
          <a className="brand" href="#/" aria-label="返回字幕工作台">
            <img className="brand-mark" src={assetUrl("icon.svg")} width="34" height="34" alt="" />
            <span className="brand-copy">
              <span className="brand-name">BiliAISub</span>
              <span className="brand-caption">Workspace contract</span>
            </span>
          </a>
          <div className="header-actions">
            <a className="header-link" href="#/">返回工作台</a>
            <a className="icon-button" href={GITHUB_REPOSITORY_URL} target="_blank" rel="noreferrer" aria-label="打开 GitHub 仓库" title="GitHub 仓库">
              <Github size={17} aria-hidden="true" />
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="page-frame specs-page">
        <section className="specs-hero" aria-labelledby="specs-title">
          <p className="eyebrow"><Workflow size={14} aria-hidden="true" />工作区规格</p>
          <h1 id="specs-title" className="specs-title">把可用范围写清楚，再开始处理字幕。</h1>
          <p className="specs-lead">这页只描述当前实现中的输入边界、状态转换、输出范围和部署分工，不把未来计划当成现有功能。</p>
        </section>

        <section className="specs-section" aria-labelledby="limits-title">
          <div className="specs-section-head">
            <span className="section-index">01</span>
            <div><h2 id="limits-title" className="section-title">处理边界</h2><p className="section-note">请求在浏览器和 API 两侧都会校验数量。</p></div>
          </div>
          <div className="specs-grid">
            {limits.map(([label, value, detail]) => <SpecCard key={label} label={label} value={value} detail={detail} />)}
          </div>
        </section>

        <section className="specs-section" aria-labelledby="states-title">
          <div className="specs-section-head">
            <span className="section-index">02</span>
            <div><h2 id="states-title" className="section-title">状态顺序</h2><p className="section-note">每一步只在上一阶段提供必要数据后出现。</p></div>
          </div>
          <div className="state-list">
            {states.map(([label, action, detail], index) => (
              <div className="state-row" key={label}>
                <span className="state-number">{String(index + 1).padStart(2, "0")}</span>
                <CheckCircle2 size={16} aria-hidden="true" />
                <div><strong>{label}</strong><span>{action}</span></div>
                <small>{detail}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="specs-section" aria-labelledby="boundary-title">
          <div className="specs-section-head">
            <span className="section-index">03</span>
            <div><h2 id="boundary-title" className="section-title">部署边界</h2><p className="section-note">静态页面与 Node.js API 分开发布。</p></div>
          </div>
          <div className="deployment-grid">
            <SpecCard label="GitHub Pages" value="静态前端" detail="Vite 输出 dist/；通过 VITE_API_BASE_URL 访问 API。" icon={<MonitorUp size={16} aria-hidden="true" />} />
            <SpecCard label="Vercel / Node.js" value="独立 API" detail="Next.js Route Handlers 负责扫码、会话、解析和 NDJSON 字幕流。" icon={<LockKeyhole size={16} aria-hidden="true" />} />
            <SpecCard label="会话保护" value="加密令牌" detail="B 站 Cookie 仅在服务端解密；跨域前端使用短期 Bearer 会话令牌。" icon={<ShieldCheck size={16} aria-hidden="true" />} />
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-inner"><span>BiliAISub · 当前实现规格</span><a className="footer-link" href="#/">返回工作台</a></div>
      </footer>
    </div>
  )
}

function SpecCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon?: ReactNode }) {
  return <article className="spec-card">{icon && <span className="spec-card-icon">{icon}</span>}<span className="spec-card-label">{label}</span><strong>{value}</strong><p>{detail}</p></article>
}

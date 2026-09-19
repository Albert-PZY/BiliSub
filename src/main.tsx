import React, { useEffect, useState } from "react"
import ReactDOM from "react-dom/client"
import { ArrowLeft, Github } from "lucide-react"
import { ThemeProvider } from "@/components/theme-provider"
import { ThemeToggle } from "@/components/theme-toggle"
import { ToastProvider } from "@/components/ui/toast"
import Home from "@/page"
import { SpecsPage } from "@/specs"
import { assetUrl } from "@/lib/assets"
import "@/globals.css"

type Route = "home" | "specs" | "not-found"

function getRoute(): Route {
  const hashPath = window.location.hash.replace(/^#/, "").split("?", 1)[0]
  if (hashPath === "/specs") return "specs"
  if (hashPath === "/") return "home"
  if (hashPath.startsWith("/")) return "not-found"

  const pagePath = getPagePath()
  if (pagePath === "/specs") return "specs"
  return pagePath === "/" ? "home" : "not-found"
}

function getPagePath(): string {
  const base = normalizeBasePath(import.meta.env.BASE_URL || "/")
  const pathname = window.location.pathname
  if (base !== "/" && pathname.startsWith(base)) {
    return `/${pathname.slice(base.length).replace(/^\/+/, "")}`.replace(/\/+$/, "") || "/"
  }
  return pathname.replace(/\/+$/, "") || "/"
}

function normalizeBasePath(value: string): string {
  const path = value.trim()
  if (!path || path === "/") return "/"
  return `/${path.replace(/^\/+|\/+$/g, "")}/`
}

function AppRouter() {
  const [route, setRoute] = useState<Route>(getRoute)

  useEffect(() => {
    let currentRoute = getRoute()
    const handleRouteChange = () => {
      const nextRoute = getRoute()
      if (nextRoute === currentRoute) return
      currentRoute = nextRoute
      setRoute(nextRoute)
      window.scrollTo({ top: 0, behavior: "auto" })
    }
    window.addEventListener("hashchange", handleRouteChange)
    window.addEventListener("popstate", handleRouteChange)
    return () => {
      window.removeEventListener("hashchange", handleRouteChange)
      window.removeEventListener("popstate", handleRouteChange)
    }
  }, [])

  if (route === "specs") return <SpecsPage />
  if (route === "not-found") return <NotFoundPage />
  return <Home />
}

function NotFoundPage() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <a className="brand" href="#/" aria-label="返回字幕工作台">
            <img className="brand-mark" src={assetUrl("icon.svg")} width="34" height="34" alt="" />
            <span className="brand-copy">
              <span className="brand-name">BiliAISub</span>
              <span className="brand-caption">Page not found</span>
            </span>
          </a>
          <div className="header-actions">
            <a className="icon-button" href="https://github.com/Albert-PZY/BiliSub" target="_blank" rel="noreferrer" aria-label="打开 GitHub 仓库" title="GitHub 仓库">
              <Github size={17} aria-hidden="true" />
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="page-frame">
        <section className="route-empty surface" aria-labelledby="route-error-title">
          <span className="route-empty__code">404</span>
          <h1 id="route-error-title">页面不存在</h1>
          <p>这个地址没有对应的工作区页面。</p>
          <a className="button" href="#/"><ArrowLeft size={16} aria-hidden="true" />返回工作台</a>
        </section>
      </main>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <AppRouter />
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>,
)

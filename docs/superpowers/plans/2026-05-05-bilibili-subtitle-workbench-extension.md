# B站字幕工作台插件 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. It will decide whether each batch should run in parallel or serial subagent mode and will pass only task-local context to each subagent. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个可直接发布到 Chrome Web Store 和 Edge Add-ons 的 MV3 侧边栏扩展，在 B 站视频页加载 AI 字幕、支持搜索/复制/导出，并通过用户自配的 OpenAI 或阿里云百炼 API Key 生成简体中文摘要。

**Architecture:** 在仓库内新增独立的 `extension/` 子项目，使用 `pnpm + TypeScript + React + Vite + @crxjs/vite-plugin` 构建 Chrome/Edge 共用扩展包。字幕数据链路采用 `B` 方案：以 `*.bilibili.com/*` 受限 host permissions 为主，通过内容脚本与页面主世界桥接复用当前登录态；摘要链路使用固定官方域名预设的 OpenAI 兼容 `chat/completions`，并把 API Key 存入 `chrome.storage.local`。

**Tech Stack:** `pnpm`、TypeScript、React、Vite、`@crxjs/vite-plugin`、Vitest、React Testing Library、Playwright

**Repository note:** 当前工作区没有 `.git` 元数据。下面所有提交步骤都使用 PowerShell 条件命令：如果仍不是 git 仓库，就输出 `SKIP_COMMIT_NO_GIT` 并继续。

---

## File Structure

- `pnpm-workspace.yaml`
  作用：把 `extension/` 声明为 pnpm workspace 包，避免和 Python 工具链混在一起。
- `.gitignore`
  作用：忽略 `extension/node_modules`、`extension/dist`、Playwright 产物。
- `extension/package.json`
  作用：扩展子项目脚本和依赖声明。
- `extension/tsconfig.json`
  作用：扩展 TypeScript 编译配置。
- `extension/vite.config.ts`
  作用：Vite、React 和 CRX 插件构建配置。
- `extension/src/manifest.ts`
  作用：MV3 manifest、权限、content scripts、side panel、options page 定义。
- `extension/src/background/index.ts`
  作用：注册 side panel 行为和可选权限辅助逻辑。
- `extension/src/content/index.ts`
  作用：隔离世界内容脚本；收集当前页面上下文、转发跳转命令、桥接页面主世界 fetch。
- `extension/src/content/main-world.ts`
  作用：运行在页面主世界，复用页面登录态请求 B 站接口。
- `extension/src/shared/runtime/messages.ts`
  作用：统一 side panel、content script、main world 之间的消息协议。
- `extension/src/shared/bilibili/types.ts`
  作用：字幕、视频元信息、错误模型。
- `extension/src/shared/bilibili/formatters.ts`
  作用：渲染全文文本和 SRT、生成导出文件名。
- `extension/src/shared/bilibili/client.ts`
  作用：B 站字幕获取主链路，移植 Python 版核心逻辑。
- `extension/src/shared/settings/provider-catalog.ts`
  作用：OpenAI 和百炼固定 provider 清单与官方 baseUrl。
- `extension/src/shared/settings/storage.ts`
  作用：`chrome.storage.local` 读写摘要设置与连通性状态。
- `extension/src/shared/llm/client.ts`
  作用：OpenAI 兼容 `chat/completions` 请求与测试连接。
- `extension/src/shared/llm/prompts.ts`
  作用：摘要 prompt 和固定简体中文输出约束。
- `extension/src/shared/llm/summarize.ts`
  作用：字幕分块、分块摘要、总摘要聚合。
- `extension/src/sidepanel/*`
  作用：工作台 UI、字幕列表、搜索、复制、导出、摘要状态展示。
- `extension/src/options/*`
  作用：provider、API Key、model 和测试连接设置页。
- `extension/tests/*`
  作用：Vitest 单元/组件测试。
- `extension/playwright.config.ts`
  作用：扩展加载和基础 smoke 验证。
- `extension/tests/e2e/*`
  作用：浏览器级 smoke 检查。
- `README.md`
  作用：新增扩展开发、打包和手动验证说明。

---

### Task 1: Bootstrap MV3 Workspace

**Satisfies:** `AC-001`, `AC-002`, `AC-003`

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `extension/package.json`
- Create: `extension/tsconfig.json`
- Create: `extension/vite.config.ts`
- Create: `extension/src/manifest.ts`
- Create: `extension/src/background/index.ts`
- Create: `extension/src/sidepanel/index.html`
- Create: `extension/src/sidepanel/main.tsx`
- Create: `extension/src/options/index.html`
- Create: `extension/src/options/main.tsx`
- Create: `extension/src/styles/base.css`
- Create: `extension/tests/setup.ts`
- Test: `extension/tests/manifest.test.ts`
- Modify: `.gitignore`

- [ ] **Step 1: 写工具链骨架和失败的 manifest 测试**

```yaml
# pnpm-workspace.yaml
packages:
  - "extension"
```

```json
// extension/package.json
{
  "name": "bilibili-subtitle-workbench-extension",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test:unit": "vitest run",
    "test:e2e": "playwright test",
    "test": "pnpm run test:unit && pnpm run test:e2e"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0-beta.27",
    "@playwright/test": "^1.54.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/chrome": "^0.0.292",
    "@types/react": "^19.0.12",
    "@types/react-dom": "^19.0.4",
    "@vitejs/plugin-react": "^4.4.1",
    "jsdom": "^26.1.0",
    "typescript": "^5.8.3",
    "vite": "^6.3.5",
    "vitest": "^3.2.4"
  }
}
```

```ts
// extension/tests/manifest.test.ts
import { describe, expect, it } from "vitest";
import manifest from "../src/manifest";

describe("manifest", () => {
  it("uses mv3 and approved host permissions", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(
      expect.arrayContaining(["storage", "downloads", "tabs", "sidePanel"]),
    );
    expect(manifest.host_permissions).toEqual([
      "https://*.bilibili.com/*",
      "https://api.openai.com/*",
      "https://dashscope.aliyuncs.com/*",
    ]);
    expect(manifest.host_permissions).not.toContain("<all_urls>");
    expect(manifest.host_permissions).not.toContain("http://127.0.0.1/*");
  });
});
```

```ts
// extension/tests/setup.ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 2: 运行测试，确认当前缺少 manifest 实现**

Run:

```powershell
pnpm install
pnpm --dir extension exec vitest run tests/manifest.test.ts
```

Expected:

```text
FAIL  tests/manifest.test.ts
Cannot find module '../src/manifest'
```

- [ ] **Step 3: 实现 manifest、构建配置和空页面入口**

```ts
// extension/src/manifest.ts
import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "B站字幕工作台",
  version: "0.1.0",
  description: "在 B 站视频页浏览 AI 字幕、导出文本，并使用自配 LLM 生成中文摘要。",
  permissions: ["storage", "downloads", "tabs", "sidePanel"],
  optional_permissions: ["cookies"],
  host_permissions: [
    "https://*.bilibili.com/*",
    "https://api.openai.com/*",
    "https://dashscope.aliyuncs.com/*"
  ],
  background: {
    service_worker: "src/background/index.ts",
    type: "module"
  },
  action: {
    default_title: "B站字幕工作台"
  },
  side_panel: {
    default_path: "src/sidepanel/index.html"
  },
  options_page: "src/options/index.html",
  content_scripts: [
    {
      matches: ["https://www.bilibili.com/video/*"],
      js: ["src/content/index.ts"]
    },
    {
      matches: ["https://www.bilibili.com/video/*"],
      js: ["src/content/main-world.ts"],
      world: "MAIN",
      run_at: "document_idle"
    }
  ]
});
```

```ts
// extension/vite.config.ts
import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import manifest from "./src/manifest";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"]
  }
});
```

```ts
// extension/src/background/index.ts
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.runtime.onStartup.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
```

```html
<!-- extension/src/sidepanel/index.html -->
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>B站字幕工作台</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

```html
<!-- extension/src/options/index.html -->
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>B站字幕工作台设置</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

```tsx
// extension/src/sidepanel/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import "../styles/base.css";

function SidePanelBoot() {
  return <main>工作台初始化中…</main>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SidePanelBoot />
  </React.StrictMode>,
);
```

```tsx
// extension/src/options/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import "../styles/base.css";

function OptionsBoot() {
  return <main>设置页初始化中…</main>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <OptionsBoot />
  </React.StrictMode>,
);
```

```css
/* extension/src/styles/base.css */
:root {
  color-scheme: light;
  font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  background:
    radial-gradient(circle at top right, rgba(0, 174, 236, 0.14), transparent 38%),
    linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
  color: #10233f;
}

body {
  margin: 0;
  min-width: 320px;
}

main {
  padding: 16px;
}
```

```gitignore
# .gitignore
.venv/
.pytest_cache/
__pycache__/
data/session.json
data/latest-login-qr.svg
extension/node_modules/
extension/dist/
extension/playwright-report/
extension/test-results/
```

- [ ] **Step 4: 运行 manifest 测试和构建**

Run:

```powershell
pnpm --dir extension exec vitest run tests/manifest.test.ts
pnpm --dir extension build
```

Expected:

```text
PASS  tests/manifest.test.ts
vite build completes and writes extension/dist/manifest.json
```

- [ ] **Step 5: 提交当前工具链骨架**

Run:

```powershell
if (git rev-parse --is-inside-work-tree 2>$null) {
  git add pnpm-workspace.yaml .gitignore extension
  git commit -m "feat: scaffold mv3 extension workspace"
} else {
  Write-Host "SKIP_COMMIT_NO_GIT"
}
```

Expected:

```text
[main ...] feat: scaffold mv3 extension workspace
```

or

```text
SKIP_COMMIT_NO_GIT
```

### Task 2: Implement Subtitle Domain Utilities

**Satisfies:** `AC-006`, `AC-010`, `AC-011`, `AC-012`

**Files:**
- Create: `extension/src/shared/bilibili/types.ts`
- Create: `extension/src/shared/bilibili/formatters.ts`
- Test: `extension/tests/formatters.test.ts`

- [ ] **Step 1: 先写失败的字幕格式化测试**

```ts
// extension/tests/formatters.test.ts
import { describe, expect, it } from "vitest";
import { buildPlainText, renderSrt } from "../src/shared/bilibili/formatters";
import type { SubtitleSegment } from "../src/shared/bilibili/types";

const segments: SubtitleSegment[] = [
  { from: 0, to: 2.5, text: "第一句" },
  { from: 2.5, to: 5, text: "第二句" }
];

describe("subtitle formatters", () => {
  it("renders plain text with one line per segment", () => {
    expect(buildPlainText(segments)).toBe("第一句\n第二句");
  });

  it("renders srt blocks with contiguous numbering", () => {
    expect(renderSrt(segments)).toContain("1\n00:00:00,000 --> 00:00:02,500\n第一句");
    expect(renderSrt(segments)).toContain("2\n00:00:02,500 --> 00:00:05,000\n第二句");
  });
});
```

- [ ] **Step 2: 运行测试，确认格式化工具缺失**

Run:

```powershell
pnpm --dir extension exec vitest run tests/formatters.test.ts
```

Expected:

```text
FAIL  tests/formatters.test.ts
Cannot find module '../src/shared/bilibili/formatters'
```

- [ ] **Step 3: 实现字幕类型和导出格式化逻辑**

```ts
// extension/src/shared/bilibili/types.ts
export interface SubtitleSegment {
  from: number;
  to: number;
  text: string;
}

export interface SubtitleTrack {
  language: string;
  languageCode: string;
  subtitleUrl: string;
}

export interface ResolvedSubtitle {
  source: string;
  title: string;
  language: string;
  subtitleUrl: string;
  segments: SubtitleSegment[];
  text: string;
}
```

```ts
// extension/src/shared/bilibili/formatters.ts
import type { SubtitleSegment } from "./types";

function formatTimestamp(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1000);
  const millis = totalMs % 1000;
  return [hours, minutes, secs].map((item) => String(item).padStart(2, "0")).join(":") + `,${String(millis).padStart(3, "0")}`;
}

export function buildPlainText(segments: SubtitleSegment[]): string {
  return segments.map((segment) => segment.text.trim()).filter(Boolean).join("\n");
}

export function renderSrt(segments: SubtitleSegment[]): string {
  return segments
    .map((segment, index) => {
      const start = formatTimestamp(segment.from);
      const end = formatTimestamp(segment.to);
      return `${index + 1}\n${start} --> ${end}\n${segment.text.trim()}`;
    })
    .join("\n\n");
}

export function buildExportFileName(bvid: string, extension: "txt" | "srt"): string {
  return `${bvid}.ai-subtitles.${extension}`;
}
```

- [ ] **Step 4: 运行格式化测试**

Run:

```powershell
pnpm --dir extension exec vitest run tests/formatters.test.ts
```

Expected:

```text
PASS  tests/formatters.test.ts
```

- [ ] **Step 5: 提交字幕领域工具**

Run:

```powershell
if (git rev-parse --is-inside-work-tree 2>$null) {
  git add extension/src/shared/bilibili extension/tests/formatters.test.ts
  git commit -m "feat: add subtitle formatter utilities"
} else {
  Write-Host "SKIP_COMMIT_NO_GIT"
}
```

Expected:

```text
[main ...] feat: add subtitle formatter utilities
```

or

```text
SKIP_COMMIT_NO_GIT
```

### Task 3: Port the Bilibili Subtitle Fetch Flow

**Satisfies:** `AC-006`, `AC-012`, `AC-013`, `AC-027`

**Files:**
- Create: `extension/src/shared/runtime/messages.ts`
- Create: `extension/src/shared/bilibili/client.ts`
- Create: `extension/src/content/main-world.ts`
- Create: `extension/src/content/index.ts`
- Test: `extension/tests/bilibili-client.test.ts`

- [ ] **Step 1: 先写失败的 B 站客户端测试**

```ts
// extension/tests/bilibili-client.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BilibiliApiClient, extractBvid } from "../src/shared/bilibili/client";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
});

describe("extractBvid", () => {
  it("extracts bvid from video url", () => {
    expect(extractBvid("https://www.bilibili.com/video/BV1darmBcE4A")).toBe("BV1darmBcE4A");
  });
});

describe("BilibiliApiClient", () => {
  it("loads subtitle segments from the bilibili api chain", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { aid: 1, cid: 2, title: "示例视频" } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          subtitle: {
            subtitles: [
              { lan: "zh-Hans", lan_doc: "简体中文", subtitle_url: "https://i0.hdslb.com/subtitle/demo.json" }
            ]
          }
        }
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        body: [{ from: 0, to: 2, content: "第一句" }]
      })));

    const client = new BilibiliApiClient(fetchMock);
    const resolved = await client.loadAiSubtitle("BV1darmBcE4A");

    expect(resolved.language).toBe("zh-Hans");
    expect(resolved.segments[0].text).toBe("第一句");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: 运行测试，确认客户端尚未实现**

Run:

```powershell
pnpm --dir extension exec vitest run tests/bilibili-client.test.ts
```

Expected:

```text
FAIL  tests/bilibili-client.test.ts
Cannot find module '../src/shared/bilibili/client'
```

- [ ] **Step 3: 移植 Python 版 B 站获取逻辑，并实现页面主世界桥接**

```ts
// extension/src/shared/runtime/messages.ts
export type PageBridgeRequest =
  | { type: "WORKBENCH_FETCH_JSON"; requestId: string; url: string }
  | { type: "WORKBENCH_JUMP_TO_TIME"; seconds: number }
  | { type: "WORKBENCH_GET_CONTEXT" };

export type PageBridgeResponse =
  | { type: "WORKBENCH_FETCH_JSON_RESULT"; requestId: string; ok: true; payload: unknown }
  | { type: "WORKBENCH_FETCH_JSON_RESULT"; requestId: string; ok: false; error: string }
  | { type: "WORKBENCH_CONTEXT_RESULT"; supported: boolean; bvid: string | null; title: string };
```

```ts
// extension/src/shared/bilibili/client.ts
import { buildPlainText } from "./formatters";
import type { ResolvedSubtitle, SubtitleSegment, SubtitleTrack } from "./types";

const BV_PATTERN = /\b(BV[0-9A-Za-z]{10})\b/;

export function extractBvid(source: string): string | null {
  const match = String(source).match(BV_PATTERN);
  return match ? match[1] : null;
}

function normalizeSubtitleUrl(raw: unknown): string {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  return value.startsWith("//") ? `https:${value}` : value;
}

function chooseBestTrack(payload: Array<Record<string, unknown>>, preferredLanguage = "zh-Hans"): SubtitleTrack | null {
  const tracks = payload
    .map((item) => ({
      language: String(item.lan ?? "").trim(),
      languageCode: String(item.lan_doc ?? "").trim(),
      subtitleUrl: normalizeSubtitleUrl(item.subtitle_url),
    }))
    .filter((track) => track.language && track.subtitleUrl);

  return tracks.find((track) => track.language === preferredLanguage) ?? tracks[0] ?? null;
}

function parseSegments(raw: any): SubtitleSegment[] {
  const body = Array.isArray(raw?.body) ? raw.body : [];
  return body
    .map((item) => ({
      from: Number(item.from ?? 0),
      to: Number(item.to ?? 0),
      text: String(item.content ?? "").trim(),
    }))
    .filter((segment) => segment.text);
}

export class BilibiliApiClient {
  constructor(private readonly requestJson: (input: string) => Promise<any>) {}

  async loadAiSubtitle(source: string, preferredLanguage = "zh-Hans"): Promise<ResolvedSubtitle> {
    const bvid = extractBvid(source);
    if (!bvid) throw new Error("无法解析 BV 号");

    const viewPayload = await this.requestJson(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
    const aid = String(viewPayload?.data?.aid ?? "").trim();
    const cid = String(viewPayload?.data?.cid ?? viewPayload?.data?.pages?.[0]?.cid ?? "").trim();
    const title = String(viewPayload?.data?.title ?? bvid).trim();
    if (!aid || !cid) throw new Error("未能解析视频 aid/cid");

    const playerPayload = await this.requestJson(`https://api.bilibili.com/x/player/wbi/v2?aid=${aid}&cid=${cid}`);
    const track = chooseBestTrack(playerPayload?.data?.subtitle?.subtitles ?? [], preferredLanguage);
    if (!track) throw new Error("无可用 AI 字幕");

    const subtitlePayload = await this.requestJson(track.subtitleUrl);
    const segments = parseSegments(subtitlePayload);
    if (segments.length === 0) throw new Error("字幕为空");

    return {
      source: bvid,
      title,
      language: track.language,
      subtitleUrl: track.subtitleUrl,
      segments,
      text: buildPlainText(segments),
    };
  }
}
```

```ts
// extension/src/content/main-world.ts
window.addEventListener("message", async (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== "WORKBENCH_FETCH_JSON") return;

  try {
    const response = await fetch(event.data.url, {
      credentials: "include",
      headers: {
        Accept: "application/json, text/plain, */*"
      }
    });
    const payload = await response.json();
    window.postMessage({
      type: "WORKBENCH_FETCH_JSON_RESULT",
      requestId: event.data.requestId,
      ok: true,
      payload
    });
  } catch (error) {
    window.postMessage({
      type: "WORKBENCH_FETCH_JSON_RESULT",
      requestId: event.data.requestId,
      ok: false,
      error: error instanceof Error ? error.message : "fetch failed"
    });
  }
});
```

```ts
// extension/src/content/index.ts
import { BilibiliApiClient, extractBvid } from "../shared/bilibili/client";

function requestPageJson(url: string): Promise<any> {
  const requestId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    const handler = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.data?.type !== "WORKBENCH_FETCH_JSON_RESULT") return;
      if (event.data.requestId !== requestId) return;
      window.removeEventListener("message", handler);
      if (event.data.ok) resolve(event.data.payload);
      else reject(new Error(event.data.error));
    };

    window.addEventListener("message", handler);
    window.postMessage({ type: "WORKBENCH_FETCH_JSON", requestId, url });
  });
}

const client = new BilibiliApiClient(requestPageJson);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "WORKBENCH_GET_CONTEXT") {
    sendResponse({
      supported: location.pathname.startsWith("/video/"),
      bvid: extractBvid(location.href),
      title: document.title
    });
    return true;
  }

  if (message.type === "WORKBENCH_LOAD_SUBTITLE") {
    client.loadAiSubtitle(location.href)
      .then((payload) => sendResponse({ ok: true, payload }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "unknown error" }));
    return true;
  }

  if (message.type === "WORKBENCH_JUMP_TO_TIME") {
    const video = document.querySelector("video");
    if (video instanceof HTMLVideoElement) {
      video.currentTime = Number(message.seconds);
      sendResponse({ ok: true });
    } else {
      sendResponse({ ok: false, error: "video element missing" });
    }
    return true;
  }
});
```

- [ ] **Step 4: 运行 B 站客户端测试**

Run:

```powershell
pnpm --dir extension exec vitest run tests/bilibili-client.test.ts
```

Expected:

```text
PASS  tests/bilibili-client.test.ts
```

- [ ] **Step 5: 提交字幕抓取主链路**

Run:

```powershell
if (git rev-parse --is-inside-work-tree 2>$null) {
  git add extension/src/shared extension/src/content extension/tests/bilibili-client.test.ts
  git commit -m "feat: port bilibili subtitle fetch flow"
} else {
  Write-Host "SKIP_COMMIT_NO_GIT"
}
```

Expected:

```text
[main ...] feat: port bilibili subtitle fetch flow
```

or

```text
SKIP_COMMIT_NO_GIT
```

### Task 4: Build the Side Panel Workbench Shell

**Satisfies:** `AC-004`, `AC-005`, `AC-006`, `AC-007`, `AC-008`, `AC-009`, `AC-012`, `AC-013`

**Files:**
- Create: `extension/src/sidepanel/App.tsx`
- Create: `extension/src/sidepanel/components/StatusPanel.tsx`
- Create: `extension/src/sidepanel/components/SubtitleList.tsx`
- Create: `extension/src/sidepanel/components/Toolbar.tsx`
- Create: `extension/src/sidepanel/hooks/useWorkbench.ts`
- Modify: `extension/src/sidepanel/main.tsx`
- Test: `extension/tests/sidepanel-app.test.tsx`

- [ ] **Step 1: 写失败的 side panel 组件测试**

```tsx
// extension/tests/sidepanel-app.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/sidepanel/App";

describe("side panel app", () => {
  it("shows unsupported state outside bilibili video pages", async () => {
    render(<App initialState={{ status: "unsupported" }} />);
    expect(screen.getByText("当前页面不支持")).toBeInTheDocument();
  });

  it("shows a search box when subtitles are ready", async () => {
    render(
      <App
        initialState={{
          status: "ready",
          title: "示例视频",
          bvid: "BV1darmBcE4A",
          segments: [{ from: 0, to: 2, text: "第一句" }],
          text: "第一句",
          summaryState: "disabled"
        }}
      />,
    );
    expect(screen.getByPlaceholderText("搜索字幕")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试，确认 UI 组件尚未实现**

Run:

```powershell
pnpm --dir extension exec vitest run tests/sidepanel-app.test.tsx
```

Expected:

```text
FAIL  tests/sidepanel-app.test.tsx
Cannot find module '../src/sidepanel/App'
```

- [ ] **Step 3: 实现工作台 UI 壳、搜索和跳转操作**

```tsx
// extension/src/sidepanel/hooks/useWorkbench.ts
import { useEffect, useMemo, useState } from "react";
import type { ResolvedSubtitle } from "../../shared/bilibili/types";

export interface WorkbenchState {
  status: "loading" | "unsupported" | "error" | "ready";
  title: string;
  bvid: string | null;
  text: string;
  segments: ResolvedSubtitle["segments"];
  errorMessage?: string;
  summaryState: "disabled" | "idle" | "loading" | "ready" | "error";
}

export function useWorkbench(initialState?: Partial<WorkbenchState>) {
  const [state, setState] = useState<WorkbenchState>({
    status: "loading",
    title: "",
    bvid: null,
    text: "",
    segments: [],
    summaryState: "disabled",
    ...initialState,
  });
  const [query, setQuery] = useState("");

  const filteredSegments = useMemo(() => {
    if (!query.trim()) return state.segments;
    return state.segments.filter((segment) => segment.text.includes(query.trim()));
  }, [query, state.segments]);

  useEffect(() => {
    if (initialState?.status) return;

    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) {
        setState((current) => ({ ...current, status: "unsupported", errorMessage: "无法定位活动标签页" }));
        return;
      }

      chrome.tabs.sendMessage(tabId, { type: "WORKBENCH_GET_CONTEXT" }, (context) => {
        if (!context?.supported) {
          setState((current) => ({ ...current, status: "unsupported" }));
          return;
        }

        chrome.tabs.sendMessage(tabId, { type: "WORKBENCH_LOAD_SUBTITLE" }, (response) => {
          if (!response?.ok) {
            setState((current) => ({ ...current, status: "error", errorMessage: response?.error ?? "字幕加载失败" }));
            return;
          }

          setState({
            status: "ready",
            title: response.payload.title,
            bvid: response.payload.source,
            text: response.payload.text,
            segments: response.payload.segments,
            summaryState: "disabled",
          });
        });
      });
    });
  }, [initialState?.status]);

  async function jumpTo(seconds: number) {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id) return;
    await chrome.tabs.sendMessage(tab.id, { type: "WORKBENCH_JUMP_TO_TIME", seconds });
  }

  return { state, query, setQuery, filteredSegments, jumpTo };
}
```

```tsx
// extension/src/sidepanel/App.tsx
import { useWorkbench, type WorkbenchState } from "./hooks/useWorkbench";

export function App({ initialState }: { initialState?: Partial<WorkbenchState> }) {
  const { state, query, setQuery, filteredSegments, jumpTo } = useWorkbench(initialState);

  if (state.status === "loading") return <main>字幕加载中…</main>;
  if (state.status === "unsupported") return <main>当前页面不支持</main>;
  if (state.status === "error") return <main>{state.errorMessage ?? "字幕加载失败"}</main>;

  return (
    <main>
      <header>
        <h1>{state.title}</h1>
        <p>{state.bvid}</p>
      </header>
      <input
        placeholder="搜索字幕"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <ul>
        {filteredSegments.length === 0 ? <li>没有匹配结果</li> : null}
        {filteredSegments.map((segment) => (
          <li key={`${segment.from}-${segment.to}`}>
            <button type="button" onClick={() => jumpTo(segment.from)}>
              {segment.text}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

```tsx
// extension/src/sidepanel/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "../styles/base.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 4: 运行 side panel 组件测试**

Run:

```powershell
pnpm --dir extension exec vitest run tests/sidepanel-app.test.tsx
```

Expected:

```text
PASS  tests/sidepanel-app.test.tsx
```

- [ ] **Step 5: 提交 side panel 壳**

Run:

```powershell
if (git rev-parse --is-inside-work-tree 2>$null) {
  git add extension/src/sidepanel extension/tests/sidepanel-app.test.tsx
  git commit -m "feat: add side panel workbench shell"
} else {
  Write-Host "SKIP_COMMIT_NO_GIT"
}
```

Expected:

```text
[main ...] feat: add side panel workbench shell
```

or

```text
SKIP_COMMIT_NO_GIT
```

### Task 5: Finish Copy and Export Actions

**Satisfies:** `AC-009`, `AC-010`, `AC-011`

**Files:**
- Modify: `extension/src/sidepanel/App.tsx`
- Create: `extension/src/sidepanel/utils/download.ts`
- Test: `extension/tests/sidepanel-export.test.tsx`

- [ ] **Step 1: 写失败的复制与导出测试**

```tsx
// extension/tests/sidepanel-export.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/sidepanel/App";

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
  });
});

describe("side panel export actions", () => {
  it("copies the full subtitle text", async () => {
    render(
      <App
        initialState={{
          status: "ready",
          title: "示例视频",
          bvid: "BV1darmBcE4A",
          segments: [{ from: 0, to: 2, text: "第一句" }],
          text: "第一句",
          summaryState: "disabled"
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "复制全文" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("第一句");
  });
});
```

- [ ] **Step 2: 运行测试，确认工具栏动作缺失**

Run:

```powershell
pnpm --dir extension exec vitest run tests/sidepanel-export.test.tsx
```

Expected:

```text
FAIL  tests/sidepanel-export.test.tsx
Unable to find role "button" with name "复制全文"
```

- [ ] **Step 3: 实现复制与下载逻辑**

```ts
// extension/src/sidepanel/utils/download.ts
export function triggerDownload(fileName: string, content: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
```

```tsx
// extension/src/sidepanel/App.tsx
import { buildExportFileName, renderSrt } from "../shared/bilibili/formatters";
import { triggerDownload } from "./utils/download";

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

// inside ready branch toolbar
<section>
  <button type="button" onClick={() => copyText(state.text)}>复制全文</button>
  <button
    type="button"
    onClick={() => triggerDownload(buildExportFileName(state.bvid ?? "subtitle", "txt"), state.text, "text/plain;charset=utf-8")}
  >
    导出 TXT
  </button>
  <button
    type="button"
    onClick={() => triggerDownload(buildExportFileName(state.bvid ?? "subtitle", "srt"), renderSrt(state.segments), "text/plain;charset=utf-8")}
  >
    导出 SRT
  </button>
</section>
```

- [ ] **Step 4: 运行复制与导出测试**

Run:

```powershell
pnpm --dir extension exec vitest run tests/sidepanel-export.test.tsx tests/formatters.test.ts
```

Expected:

```text
PASS  tests/sidepanel-export.test.tsx
PASS  tests/formatters.test.ts
```

- [ ] **Step 5: 提交复制与导出能力**

Run:

```powershell
if (git rev-parse --is-inside-work-tree 2>$null) {
  git add extension/src/sidepanel extension/tests/sidepanel-export.test.tsx
  git commit -m "feat: add copy and export actions"
} else {
  Write-Host "SKIP_COMMIT_NO_GIT"
}
```

Expected:

```text
[main ...] feat: add copy and export actions
```

or

```text
SKIP_COMMIT_NO_GIT
```

### Task 6: Add Settings Storage and Provider Configuration

**Satisfies:** `AC-014`, `AC-015`, `AC-016`, `AC-017`, `AC-018`, `AC-019`, `AC-020`

**Files:**
- Create: `extension/src/shared/settings/provider-catalog.ts`
- Create: `extension/src/shared/settings/storage.ts`
- Create: `extension/src/options/App.tsx`
- Modify: `extension/src/options/main.tsx`
- Test: `extension/tests/settings-storage.test.ts`

- [ ] **Step 1: 写失败的设置存储和 provider 测试**

```ts
// extension/tests/settings-storage.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DASHSCOPE_PROVIDER, OPENAI_PROVIDER } from "../src/shared/settings/provider-catalog";
import { loadSummarySettings, saveSummarySettings } from "../src/shared/settings/storage";

const localStore = new Map<string, unknown>();
const syncStore = new Map<string, unknown>();

beforeEach(() => {
  localStore.clear();
  syncStore.clear();
  chrome.storage = {
    local: {
      get: vi.fn(async () => Object.fromEntries(localStore)),
      set: vi.fn(async (payload) => Object.entries(payload).forEach(([key, value]) => localStore.set(key, value))),
    },
    sync: {
      get: vi.fn(async () => Object.fromEntries(syncStore)),
      set: vi.fn(async (payload) => Object.entries(payload).forEach(([key, value]) => syncStore.set(key, value))),
    },
  } as any;
});

describe("summary settings storage", () => {
  it("persists api key only in local storage", async () => {
    await saveSummarySettings({
      provider: OPENAI_PROVIDER.id,
      baseUrl: OPENAI_PROVIDER.baseUrl,
      apiKey: "sk-demo",
      model: "gpt-4.1-mini",
      temperature: 0.2,
      maxOutputTokens: 1200,
      connectionStatus: "passed",
    });

    const settings = await loadSummarySettings();
    expect(settings.apiKey).toBe("sk-demo");
    expect(syncStore.size).toBe(0);
  });

  it("keeps dashscope on its official preset url", () => {
    expect(DASHSCOPE_PROVIDER.baseUrl).toBe("https://dashscope.aliyuncs.com/compatible-mode/v1");
  });
});
```

- [ ] **Step 2: 运行测试，确认设置模块缺失**

Run:

```powershell
pnpm --dir extension exec vitest run tests/settings-storage.test.ts
```

Expected:

```text
FAIL  tests/settings-storage.test.ts
Cannot find module '../src/shared/settings/provider-catalog'
```

- [ ] **Step 3: 实现 provider 清单、本地存储和设置页表单**

```ts
// extension/src/shared/settings/provider-catalog.ts
export const OPENAI_PROVIDER = {
  id: "openai",
  label: "OpenAI",
  baseUrl: "https://api.openai.com/v1",
};

export const DASHSCOPE_PROVIDER = {
  id: "dashscope",
  label: "阿里云百炼",
  baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
};

export const PROVIDERS = [OPENAI_PROVIDER, DASHSCOPE_PROVIDER] as const;
```

```ts
// extension/src/shared/settings/storage.ts
export interface SummarySettings {
  provider: "openai" | "dashscope";
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxOutputTokens: number;
  connectionStatus: "unknown" | "passed" | "failed";
  connectionError?: string;
}

const SETTINGS_KEY = "summarySettings";

export async function loadSummarySettings(): Promise<SummarySettings> {
  const payload = await chrome.storage.local.get(SETTINGS_KEY);
  return (payload[SETTINGS_KEY] as SummarySettings | undefined) ?? {
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "",
    temperature: 0.2,
    maxOutputTokens: 1200,
    connectionStatus: "unknown",
  };
}

export async function saveSummarySettings(settings: SummarySettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}
```

```tsx
// extension/src/options/App.tsx
import { useEffect, useState } from "react";
import { DASHSCOPE_PROVIDER, OPENAI_PROVIDER, PROVIDERS } from "../shared/settings/provider-catalog";
import { loadSummarySettings, saveSummarySettings, type SummarySettings } from "../shared/settings/storage";

export function OptionsApp() {
  const [settings, setSettings] = useState<SummarySettings | null>(null);

  useEffect(() => {
    loadSummarySettings().then(setSettings);
  }, []);

  if (!settings) return <main>设置加载中…</main>;

  return (
    <main>
      <h1>摘要设置</h1>
      <label>
        Provider
        <select
          value={settings.provider}
          onChange={(event) => {
            const provider = event.target.value as SummarySettings["provider"];
            const baseUrl = provider === OPENAI_PROVIDER.id ? OPENAI_PROVIDER.baseUrl : DASHSCOPE_PROVIDER.baseUrl;
            setSettings({ ...settings, provider, baseUrl, connectionStatus: "unknown", connectionError: undefined });
          }}
        >
          {PROVIDERS.map((provider) => (
            <option key={provider.id} value={provider.id}>{provider.label}</option>
          ))}
        </select>
      </label>
      <label>
        API Key
        <input
          type="password"
          value={settings.apiKey}
          onChange={(event) => setSettings({ ...settings, apiKey: event.target.value, connectionStatus: "unknown" })}
        />
      </label>
      <label>
        Model
        <input
          value={settings.model}
          onChange={(event) => setSettings({ ...settings, model: event.target.value, connectionStatus: "unknown" })}
        />
      </label>
      <p>Base URL: {settings.baseUrl}</p>
      <button type="button" onClick={() => saveSummarySettings(settings)}>保存设置</button>
    </main>
  );
}
```

```tsx
// extension/src/options/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { OptionsApp } from "./App";
import "../styles/base.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>,
);
```

- [ ] **Step 4: 运行设置相关测试**

Run:

```powershell
pnpm --dir extension exec vitest run tests/settings-storage.test.ts
```

Expected:

```text
PASS  tests/settings-storage.test.ts
```

- [ ] **Step 5: 提交设置页与 provider 配置**

Run:

```powershell
if (git rev-parse --is-inside-work-tree 2>$null) {
  git add extension/src/shared/settings extension/src/options extension/tests/settings-storage.test.ts
  git commit -m "feat: add provider settings storage"
} else {
  Write-Host "SKIP_COMMIT_NO_GIT"
}
```

Expected:

```text
[main ...] feat: add provider settings storage
```

or

```text
SKIP_COMMIT_NO_GIT
```

### Task 7: Implement LLM Test Connection and Summary Pipeline

**Satisfies:** `AC-020`, `AC-021`, `AC-022`, `AC-023`, `AC-024`, `AC-025`, `AC-026`

**Files:**
- Create: `extension/src/shared/llm/client.ts`
- Create: `extension/src/shared/llm/prompts.ts`
- Create: `extension/src/shared/llm/summarize.ts`
- Modify: `extension/src/options/App.tsx`
- Modify: `extension/src/sidepanel/App.tsx`
- Test: `extension/tests/llm-client.test.ts`
- Test: `extension/tests/summarize.test.ts`

- [ ] **Step 1: 写失败的 LLM 客户端与摘要测试**

```ts
// extension/tests/llm-client.test.ts
import { describe, expect, it, vi } from "vitest";
import { createChatCompletionsClient } from "../src/shared/llm/client";

describe("llm client", () => {
  it("calls the approved chat completions path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '{"summary":"好的"}' } }] })),
    );

    const client = createChatCompletionsClient(fetchMock);
    await client.complete({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-demo",
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: "你好" }],
      temperature: 0.2,
      maxOutputTokens: 1200,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
```

```ts
// extension/tests/summarize.test.ts
import { describe, expect, it, vi } from "vitest";
import { summarizeSegments } from "../src/shared/llm/summarize";

describe("summarizeSegments", () => {
  it("returns chinese summary payload", async () => {
    const complete = vi.fn()
      .mockResolvedValueOnce('{"summary":"分块摘要","key_points":["一点"],"timeline_sections":[],"action_items":[],"keywords":["关键词"]}')
      .mockResolvedValueOnce('{"summary":"最终摘要","key_points":["总结"],"timeline_sections":[],"action_items":[],"keywords":["关键词"]}');

    const result = await summarizeSegments({
      title: "示例视频",
      segments: [{ from: 0, to: 2, text: "This is a test sentence." }],
      settings: {
        provider: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-demo",
        model: "gpt-4.1-mini",
        temperature: 0.2,
        maxOutputTokens: 1200,
        connectionStatus: "passed",
      },
      complete,
    });

    expect(result.summary).toBe("最终摘要");
    expect(result.key_points[0]).toBe("总结");
  });
});
```

- [ ] **Step 2: 运行测试，确认摘要链路未实现**

Run:

```powershell
pnpm --dir extension exec vitest run tests/llm-client.test.ts tests/summarize.test.ts
```

Expected:

```text
FAIL  tests/llm-client.test.ts
FAIL  tests/summarize.test.ts
```

- [ ] **Step 3: 实现连接测试、固定中文 prompt 和摘要按钮禁用逻辑**

```ts
// extension/src/shared/llm/client.ts
export function createChatCompletionsClient(fetchImpl: typeof fetch = fetch) {
  return {
    async complete(input: {
      baseUrl: string;
      apiKey: string;
      model: string;
      messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
      temperature: number;
      maxOutputTokens: number;
    }) {
      const response = await fetchImpl(`${input.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${input.apiKey}`,
        },
        body: JSON.stringify({
          model: input.model,
          messages: input.messages,
          temperature: input.temperature,
          max_tokens: input.maxOutputTokens,
        }),
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const payload = await response.json();
      return String(payload?.choices?.[0]?.message?.content ?? "");
    },
  };
}
```

```ts
// extension/src/shared/llm/prompts.ts
export function buildChunkSummaryPrompt(title: string, chunkText: string): string {
  return [
    "你是一个视频字幕摘要助手。",
    "你必须只输出简体中文 JSON。",
    "JSON 必须包含 summary、key_points、timeline_sections、action_items、keywords 五个字段。",
    `视频标题：${title}`,
    "以下是字幕片段：",
    chunkText,
  ].join("\n");
}
```

```ts
// extension/src/shared/llm/summarize.ts
import { buildPlainText } from "../bilibili/formatters";
import type { SubtitleSegment } from "../bilibili/types";
import type { SummarySettings } from "../settings/storage";

export interface SummaryResult {
  summary: string;
  key_points: string[];
  timeline_sections: Array<{ heading: string; summary: string }>;
  action_items: string[];
  keywords: string[];
}

function chunkSegments(segments: SubtitleSegment[], maxChars = 4000): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const segment of segments) {
    const line = `${segment.text}\n`;
    if (current.length + line.length > maxChars && current) {
      chunks.push(current.trim());
      current = "";
    }
    current += line;
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export async function summarizeSegments(input: {
  title: string;
  segments: SubtitleSegment[];
  settings: SummarySettings;
  complete: (prompt: string) => Promise<string>;
}): Promise<SummaryResult> {
  const chunks = chunkSegments(input.segments);
  const chunkSummaries: string[] = [];

  for (const chunk of chunks) {
    chunkSummaries.push(await input.complete(chunk));
  }

  const finalPayload = await input.complete(buildPlainText(chunkSummaries.map((summary, index) => ({
    from: index,
    to: index + 1,
    text: summary,
  }))));

  return JSON.parse(finalPayload) as SummaryResult;
}
```

```tsx
// extension/src/options/App.tsx
import { createChatCompletionsClient } from "../shared/llm/client";

async function testConnection(settings: SummarySettings) {
  const client = createChatCompletionsClient();
  await client.complete({
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    temperature: settings.temperature,
    maxOutputTokens: settings.maxOutputTokens,
    messages: [{ role: "user", content: "请只返回 OK" }],
  });
}

// add button and handler
<button
  type="button"
  onClick={async () => {
    try {
      await testConnection(settings);
      const next = { ...settings, connectionStatus: "passed" as const, connectionError: undefined };
      setSettings(next);
      await saveSummarySettings(next);
    } catch (error) {
      const next = { ...settings, connectionStatus: "failed" as const, connectionError: error instanceof Error ? error.message : "连接失败" };
      setSettings(next);
      await saveSummarySettings(next);
    }
  }}
>
  测试连接
</button>
```

```tsx
// extension/src/sidepanel/App.tsx
const summaryDisabled = state.summaryState === "disabled" || state.status !== "ready";

<button type="button" disabled={summaryDisabled}>
  生成摘要
</button>
{state.summaryState === "disabled" ? <p>未配置可用 LLM，摘要不可用。</p> : null}
```

- [ ] **Step 4: 运行 LLM 与摘要测试**

Run:

```powershell
pnpm --dir extension exec vitest run tests/llm-client.test.ts tests/summarize.test.ts tests/settings-storage.test.ts
```

Expected:

```text
PASS  tests/llm-client.test.ts
PASS  tests/summarize.test.ts
PASS  tests/settings-storage.test.ts
```

- [ ] **Step 5: 提交 LLM 配置与摘要主链路**

Run:

```powershell
if (git rev-parse --is-inside-work-tree 2>$null) {
  git add extension/src/shared/llm extension/src/options extension/src/sidepanel extension/tests/llm-client.test.ts extension/tests/summarize.test.ts
  git commit -m "feat: add llm summary pipeline"
} else {
  Write-Host "SKIP_COMMIT_NO_GIT"
}
```

Expected:

```text
[main ...] feat: add llm summary pipeline
```

or

```text
SKIP_COMMIT_NO_GIT
```

### Task 8: Add Smoke Verification and Repository Docs

**Satisfies:** `AC-001` through `AC-027`

**Files:**
- Create: `extension/playwright.config.ts`
- Create: `extension/tests/e2e/manifest-smoke.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: 写失败的 smoke 测试骨架**

```ts
// extension/tests/e2e/manifest-smoke.spec.ts
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("built extension manifest exists", async () => {
  const raw = await readFile(new URL("../../dist/manifest.json", import.meta.url), "utf-8");
  const manifest = JSON.parse(raw);
  expect(manifest.manifest_version).toBe(3);
});
```

- [ ] **Step 2: 运行 smoke 测试，确认当前没有 Playwright 配置**

Run:

```powershell
pnpm --dir extension exec playwright test
```

Expected:

```text
Error: No tests found or playwright config missing
```

- [ ] **Step 3: 实现测试初始化、Playwright 配置和 README 扩展说明**

```ts
// extension/tests/setup.ts
import "@testing-library/jest-dom/vitest";
```

```ts
// extension/playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    headless: true,
  },
});
```

```md
<!-- README.md append section -->
## 浏览器插件开发

~~~powershell
pnpm install
pnpm --dir extension build
~~~

本地加载：

1. 打开 Chrome 或 Edge 的扩展管理页
2. 启用开发者模式
3. 选择“加载已解压的扩展程序”
4. 指向 `extension/dist`

扩展要求：

- 仅在 `https://www.bilibili.com/video/*` 页面工作
- 摘要功能需要用户自行配置 OpenAI 或阿里云百炼 API Key
- 摘要固定输出简体中文
```

- [ ] **Step 4: 运行最终构建和测试命令**

Run:

```powershell
pnpm --dir extension exec vitest run
pnpm --dir extension build
pnpm --dir extension exec playwright test
```

Expected:

```text
All Vitest suites pass
vite build completes
Playwright smoke test passes
```

- [ ] **Step 5: 提交最终文档和验证配置**

Run:

```powershell
if (git rev-parse --is-inside-work-tree 2>$null) {
  git add README.md extension/playwright.config.ts extension/tests/setup.ts extension/tests/e2e
  git commit -m "docs: add extension verification guide"
} else {
  Write-Host "SKIP_COMMIT_NO_GIT"
}
```

Expected:

```text
[main ...] docs: add extension verification guide
```

or

```text
SKIP_COMMIT_NO_GIT
```

## Self-Review

- Spec coverage:
  - Chrome/Edge MV3 兼容与权限边界由 Task 1 覆盖。
  - B 方案字幕链路、无 `localhost` 依赖由 Task 3 覆盖。
  - 字幕列表、搜索、跳转、复制、导出由 Task 4 和 Task 5 覆盖。
  - Provider 限制、API Key 本地存储、测试连接由 Task 6 覆盖。
  - OpenAI 兼容摘要、中文输出、失效即不可用由 Task 7 覆盖。
  - 最终文档与 smoke 验证由 Task 8 覆盖。
- Placeholder scan:
  - 未保留 `TODO`、`TBD` 或“自行实现”类描述。
- Type consistency:
  - `SummarySettings`、`ResolvedSubtitle`、`SummaryResult`、`BilibiliApiClient` 在各任务中使用了同一命名。

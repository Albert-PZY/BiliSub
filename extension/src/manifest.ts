import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "B站字幕工作台",
  version: "0.1.0",
  description: "在 B 站视频页浏览 AI 字幕、导出文本，并使用自配 LLM 生成中文摘要。",
  icons: {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png",
  },
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
    default_title: "B站字幕工作台",
    default_icon: {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
    },
  },
  side_panel: {
    default_path: "src/sidepanel/index.html",
  },
  options_page: "src/options/index.html",
  content_scripts: [
    {
      matches: ["https://www.bilibili.com/video/*"],
      js: ["src/content/index.ts"],
    },
    {
      matches: ["https://www.bilibili.com/video/*"],
      js: ["src/content/main-world.ts"],
      world: "MAIN",
      run_at: "document_idle",
    },
  ],
});

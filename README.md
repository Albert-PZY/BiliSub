# BiliAISub

一个独立、轻量的 Python 小工具，用来：

- 扫码登录 B 站并把登录态持久化到本地
- 通过 `BV` 号或 B 站视频链接获取 AI 字幕
- 直接输出 `text` / `srt` / `raw-json`

项目默认把本地会话保存到 `data/session.json`，不做额外加密，方便你直接查看和迁移。

## 安装

```powershell
cd F:\BiliAISub
uv sync
```

## 命令

### 1. 扫码登录

```powershell
uv run bili-ai-sub login
```

或：

```powershell
uv run biliaisub login
```

执行后会：

- 在终端打印可扫码的 ASCII 二维码
- 在 `data/latest-login-qr.svg` 保存一份 SVG 二维码
- 自动轮询直到扫码成功或超时

### 2. 查看登录态

```powershell
uv run biliaisub status
```

### 3. 清除登录态

```powershell
uv run biliaisub logout
```

### 4. 获取 AI 字幕

输出纯文本：

```powershell
uv run biliaisub subtitles BV1darmBcE4A
```

指定 B 站链接：

```powershell
uv run biliaisub subtitles "https://www.bilibili.com/video/BV1darmBcE4A"
```

导出 SRT：

```powershell
uv run biliaisub subtitles BV1darmBcE4A --format srt --output .\demo.srt
```

导出原始 AI 字幕 JSON：

```powershell
uv run biliaisub subtitles BV1darmBcE4A --format raw-json --output .\demo.json
```

指定目标语言优先级：

```powershell
uv run biliaisub subtitles BV1darmBcE4A --language zh-Hans
```

## 作为库使用

```python
from bili_ai_sub import BilibiliClient, SessionStore, render_srt

store = SessionStore()
with BilibiliClient(store=store) as client:
    subtitle = client.fetch_ai_subtitle("BV1darmBcE4A", preferred_language="zh-Hans")
    print(subtitle.text)
    print(render_srt(subtitle.segments))
```

## 极简 HTTP API

启动服务：

```powershell
uv run biliaisub serve --host 127.0.0.1 --port 8933
```

默认返回 JSON，并且自带最基础的 CORS 头，浏览器本地页面也可以直接调。

### 接口列表

- `GET /health`
- `GET /status`
- `POST /login/start`
- `GET /login/poll?qrcode_key=...`
- `POST /logout`
- `GET /subtitles?source=BV1darmBcE4A&language=zh-Hans&include_raw=1`

也兼容 `/api/*` 前缀，例如 `/api/health`、`/api/status`。

### 示例

查看健康状态：

```powershell
curl http://127.0.0.1:8933/health
```

启动二维码登录：

```powershell
curl -Method Post http://127.0.0.1:8933/login/start
```

获取字幕：

```powershell
curl "http://127.0.0.1:8933/subtitles?source=BV1darmBcE4A&language=zh-Hans&include_raw=1"
```

## 测试

```powershell
uv run pytest tests -q
```

## 浏览器插件开发

浏览器插件代码位于 `extension/`，使用 `pnpm + TypeScript + React + Vite` 构建，目标是同一份 `MV3` 包同时兼容 Chrome 和 Edge。

安装依赖并构建：

```powershell
pnpm install
pnpm --dir extension build
```

运行单测和 smoke 检查：

```powershell
pnpm --dir extension exec vitest run
pnpm --dir extension exec playwright test
```

本地加载未打包发布前的扩展产物：

1. 打开 Chrome 或 Edge 的扩展管理页。
2. 启用“开发者模式”。
3. 选择“加载已解压的扩展程序”。
4. 指向 `extension/dist` 目录。

当前扩展约束：

- 仅在 `https://www.bilibili.com/video/*` 页面启用字幕工作台。
- 摘要 provider 仅支持 `OpenAI` 与 `阿里云百炼`，并固定使用官方域名预设。
- 摘要请求统一走 OpenAI 兼容的 `POST /chat/completions`。
- 用户 API Key 仅保存到 `chrome.storage.local`。
- 摘要固定输出简体中文；如果 LLM 不可用或连接测试未通过，摘要功能直接不可用。
- 公开版扩展不依赖本地 Python 环境、`localhost` 或 `127.0.0.1` 辅助服务。

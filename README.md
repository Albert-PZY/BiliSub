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

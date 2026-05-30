# BiliAISub

一个极简、独立的 B 站 AI 字幕获取工具。

它只做三件事：

- 扫码登录 B 站，并把登录态保存到本机
- 通过 BV 号或 B 站视频链接获取官方 AI 字幕
- 支持命令行导出，也支持本地网页批量提取和下载

本地会话默认保存到 `data/session.json`。这个文件不做额外加密，适合个人本机使用，不要提交到仓库或发给他人。

## 安装

```powershell
cd "F:\in-house project\BiliAISub"
uv sync
```

## 本地网页工具

启动：

```powershell
uv run biliaisub web
```

默认地址：

```text
http://127.0.0.1:8933
```

页面能力：

- 生成 B 站扫码登录二维码
- 查看和清除本机登录态
- 粘贴多行 BV 号或 B 站视频链接
- 批量获取全部可用 AI 字幕语言，或只获取指定语言
- 在右侧按语言标签页切换编辑
- 按当前语言、当前视频全部语言或全部成功字幕下载 TXT、SRT、JSON

网页前端位于 `frontend/`，使用 Next.js 静态导出。Python 只负责本机页面服务、扫码登录、保存登录态和请求 B 站字幕。

### GitHub Pages

项目会通过 GitHub Actions 自动把 `frontend/` 静态页面部署到 GitHub Pages。Pages 页面只适合作为公开展示和静态入口；真实扫码登录、登录态读取和 B 站字幕请求必须在本机运行 `uv run biliaisub web` 后由本地 Python 服务提供。

### 前端开发

```powershell
pnpm --dir frontend install
pnpm --dir frontend dev
```

开发服务默认会跑在 Next 的端口上；实际登录和字幕请求仍需要 Python 本地服务提供 `/local/*` 动作。

### 前端构建并同步到 Python 页面

```powershell
pnpm --dir frontend build
```

构建完成后会把 `frontend/out` 同步到 `src/bili_ai_sub/web_static`。随后运行 `uv run biliaisub web` 即可看到最新页面。

## 命令行

### 扫码登录

```powershell
uv run biliaisub login
```

执行后会：

- 在终端打印可扫码的 ASCII 二维码
- 在 `data/latest-login-qr.svg` 保存一份 SVG 二维码
- 自动轮询直到扫码成功或超时

### 查看登录态

```powershell
uv run biliaisub status
```

### 清除登录态

```powershell
uv run biliaisub logout
```

### 获取 AI 字幕

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

## 项目结构

```text
src/bili_ai_sub/
  bilibili.py              B 站扫码登录、登录态校验、字幕获取和格式化
  cli.py                   命令行入口
  models.py                轻量数据模型
  store.py                 本机会话文件读写
  web.py                   只绑定本机的网页工具服务
  web_static/
    ...                    Next 静态导出产物，由 pnpm --dir frontend build 生成
frontend/
  app/                     页面入口
  components/              登录、视频输入、字幕列表、编辑和下载组件
  lib/local-api.ts         调用 Python 本地服务的前端 API 封装
  scripts/sync-static.mjs  构建后同步静态产物
tests/
  test_bilibili_utils.py   BV 解析、字幕轨选择
  test_client.py           B 站客户端核心流程
  test_store.py            本机会话存储
  test_web.py              本地网页服务
```

## 测试

```powershell
uv run python -m pytest tests -q
```

前端类型检查：

```powershell
pnpm --dir frontend exec tsc --noEmit
```

完整前端构建：

```powershell
pnpm --dir frontend build
```

## 提交与发布

提交信息遵循约定式提交，详见 `docs/git-commit-guidelines.md`。

本项目使用 Release Please 管理版本 PR、CHANGELOG、GitHub Release 和版本标签。普通功能提交不会直接打正式 tag；当多个变更积累到一个稳定发布点后，合并 Release Please 创建的发布 PR 才会发布版本。

## 设计边界

- 不包含浏览器插件代码
- 不包含公开 HTTP API 契约
- 不做字幕翻译、摘要、LLM 调用
- 不托管任何远端服务，登录态只留在本机

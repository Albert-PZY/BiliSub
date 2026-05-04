---
type: module_card
title: bili-ai-sub-core
summary: 当前仓库围绕 Bilibili 登录态和 AI 字幕抓取构建，CLI、本地存储和本地 HTTP API 共用同一套能力核心。
tags:
  - bilibili
  - subtitles
  - cli
  - local-api
owned_paths:
  - src/bili_ai_sub
  - tests
related_docs:
  - docs/superpowers/specs/2026-05-04-browser-extension-positioning-design.md
entrypoints:
  - src/bili_ai_sub/cli.py
  - src/bili_ai_sub/bilibili.py
  - src/bili_ai_sub/store.py
  - src/bili_ai_sub/api_service.py
  - src/bili_ai_sub/http_api.py
status: active
---

# bili-ai-sub-core

## Responsibilities

- 发起并轮询 Bilibili 二维码登录
- 将登录态 Cookie 持久化到本地 `data/session.json`
- 根据 `BV` 号或视频链接解析视频信息
- 获取可用 AI 字幕轨并转换为文本、SRT 或原始 JSON
- 通过 CLI 和本地 HTTP API 暴露统一能力

## Entry Points

- CLI 总入口：[src/bili_ai_sub/cli.py](/F:/BiliAISub/src/bili_ai_sub/cli.py:15)
- 字幕抓取主流程：[src/bili_ai_sub/bilibili.py](/F:/BiliAISub/src/bili_ai_sub/bilibili.py:141)
- 本地会话存储：[src/bili_ai_sub/store.py](/F:/BiliAISub/src/bili_ai_sub/store.py:21)
- API 服务组装：[src/bili_ai_sub/api_service.py](/F:/BiliAISub/src/bili_ai_sub/api_service.py:10)
- HTTP 路由层：[src/bili_ai_sub/http_api.py](/F:/BiliAISub/src/bili_ai_sub/http_api.py:11)

## Invariants

- 没有有效登录态时，字幕抓取必须失败并要求重新登录。
- 本地会话只保留白名单 Cookie 字段，不直接透传任意 Cookie。
- 字幕能力依赖 Bilibili 的现有 AI 字幕轨，不负责语音转写生成。
- CLI 与本地 HTTP API 应基于同一套 `BilibiliClient` 和 `SessionStore` 行为。

## Extension Points

- 增加更多导出格式
- 在 `ApiService` 层增加摘要、搜索、切片等高阶能力
- 被桌面壳或浏览器插件通过本地 HTTP API 复用

## Common Pitfalls

- 把项目误判成“字幕生成器”而不是“登录态下的字幕提取器”
- 直接把浏览器插件做成云端服务，导致登录态与隐私复杂度急剧上升
- 过早扩展到多平台，稀释当前 Bilibili 专用链路的稳定性

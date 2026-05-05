# 浏览器插件发布清单

适用对象：

- Chrome Web Store
- Microsoft Edge Add-ons

当前仓库已经准备好的产物：

- 扩展打包目录：`extension/dist`
- Manifest 图标：`extension/public/icons/icon16.png`、`icon32.png`、`icon48.png`、`icon128.png`
- 商店素材起稿：
  - `docs/publishing/assets/store-logo-300x300.png`
  - `docs/publishing/assets/store-small-promo-440x280.png`
  - `docs/publishing/assets/store-marquee-1400x560.png`
  - `docs/publishing/assets/store-screenshot-frame-1280x800.png`
- 素材生成脚本：`extension/scripts/generate-store-assets.ps1`

重新生成图标和商店素材：

```powershell
pwsh .\extension\scripts\generate-store-assets.ps1
```

## 1. 打包前自检

- 运行 `pnpm --dir extension exec vitest run`
- 运行 `pnpm --dir extension build`
- 运行 `pnpm --dir extension exec playwright test`
- 确认 `extension/dist/manifest.json` 中没有 `<all_urls>`、`localhost`、`127.0.0.1`
- 确认摘要 provider 仍然只包含 `OpenAI` 与 `阿里云百炼`

## 2. Chrome Web Store 提交前

- 准备 ZIP 包：
  - 将 `extension/dist` 目录内容打成 zip
- Listing 基础信息：
  - 名称：`B站字幕工作台`
  - 简短描述建议：`在 B 站视频页加载 AI 字幕，支持搜索、导出，并用自配 OpenAI/百炼生成中文摘要。`
  - 详细描述建议：
    - 在 B 站视频页读取 AI 字幕并展示为可搜索列表
    - 支持点击字幕跳转、复制全文、导出 TXT / SRT
    - 用户可自配 OpenAI 或阿里云百炼 API Key
    - 摘要通过 OpenAI 兼容接口生成，固定输出简体中文
- 必备素材：
  - `128x128` 图标
  - 至少一张实际产品截图
  - 小型宣传图
- 隐私与合规：
  - 在开发者后台填写隐私实践
  - 建议提供公开可访问的隐私政策 URL
  - 明确声明：API Key 仅保存在本地；字幕内容只有在用户手动点击“生成摘要”后才会发送到所选 LLM 官方域名

## 3. Edge Add-ons 提交前

- 可复用同一份 ZIP 包：`extension/dist`
- Listing 基础信息可复用 Chrome 的名称与描述
- 建议素材：
  - Logo：优先使用 `store-logo-300x300.png`
  - Small promotional tile：优先使用 `store-small-promo-440x280.png`
  - Marquee promotional tile：优先使用 `store-marquee-1400x560.png`
- 仍然建议准备 1 到 3 张真实插件截图，方便商店页转化

## 4. 推荐手工截图内容

至少截这三张：

1. B 站视频页，侧边栏展开，已加载字幕列表
2. 搜索字幕后的过滤结果
3. 已生成摘要后的结果视图

截图建议：

- 宽度优先保持在桌面端，避免只截局部
- 不要暴露真实 API Key
- 选一条字幕内容质量高、结构清晰的视频做示例

## 5. 权限说明模板

提交商店时可以直接参考这份说明：

- `storage`：保存用户选择的 provider、model、API Key 与连接测试状态
- `downloads`：导出字幕 TXT / SRT 文件
- `tabs`：定位当前活动的 B 站视频标签页
- `sidePanel`：在浏览器侧边栏展示字幕工作台
- `cookies`（可选）：仅用于复用当前浏览器中的 B 站登录态能力
- `https://*.bilibili.com/*`：读取当前视频页上下文并请求 B 站字幕接口
- `https://api.openai.com/*`：在用户主动触发摘要时请求 OpenAI 官方接口
- `https://dashscope.aliyuncs.com/*`：在用户主动触发摘要时请求阿里云百炼官方兼容接口

## 6. 数据流说明模板

- 扩展默认不会把字幕内容发给任何 LLM 服务
- 只有当用户已经完成设置、测试连接通过，并主动点击“生成摘要”时，字幕内容才会发送到当前所选 provider 的官方域名
- API Key 仅存放在 `chrome.storage.local`
- 不依赖本地 Python、`localhost` 或 `127.0.0.1` 服务

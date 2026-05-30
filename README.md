# BiliAISub

一个 Next.js 全栈 TS 版 B 站 AI 字幕获取工具。

它只做三件事：

- 扫码登录 B 站
- 通过 BV 号或 B 站视频链接获取官方 AI 字幕
- 按语言切换编辑，并下载 TXT、SRT、JSON

登录态保存在加密的 HttpOnly Cookie 里，前端 JS 读不到。部署到 Vercel 时必须设置 `BILI_SUB_SESSION_SECRET`。

## 本地启动

```powershell
pnpm install
pnpm dev
```

默认地址：

```text
http://localhost:3000
```

## 环境变量

本地开发可不配，生产必须配：

```text
BILI_SUB_SESSION_SECRET=一串足够长的随机字符串
```

生成示例：

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 项目结构

```text
app/
  api/                    Next.js API Routes，负责登录和字幕请求
  page.tsx                页面入口
components/               登录、视频输入、字幕列表、编辑、下载组件
lib/server/
  bilibili.ts             B 站扫码登录、字幕获取、SRT 格式化
  session.ts              加密 HttpOnly Cookie 会话
lib/local-api.ts          前端请求 API 的类型和工具
```

## 常用命令

```powershell
pnpm typecheck
pnpm build
pnpm dev
```

## 部署

推荐部署到 Vercel。GitHub Pages 不能跑服务端接口，所以不再作为主部署方式。

## 提交与发布

提交信息遵循约定式提交，详见 `docs/git-commit-guidelines.md`。

Release Please 只创建发布 PR，不会因为普通提交直接打正式 tag。等多个变更积累到稳定发布点后，再合并发布 PR。

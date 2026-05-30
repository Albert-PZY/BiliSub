# BiliAISub

BiliAISub 是一个 Next.js 全栈 TypeScript 应用，用来扫码登录 B 站并获取官方 AI 字幕。

它只保留当前核心能力：

- B 站扫码登录
- 通过 BV 号或 B 站视频链接获取官方 AI 字幕
- 一次获取全部可用字幕语言，或只获取指定语言
- 在页面右侧按语言标签切换编辑
- 下载当前语言、当前视频全部语言或全部成功字幕的 TXT、SRT、JSON

登录态保存在加密的 HttpOnly Cookie 里，前端 JS 读不到。生产环境必须设置 `BILI_SUB_SESSION_SECRET`。

## 本地启动

```powershell
pnpm install
pnpm dev
```

打开：

```text
http://localhost:3000
```

本地开发不配置 `BILI_SUB_SESSION_SECRET` 也能跑，生产环境不能省。

## 环境变量

生产环境必填：

```text
BILI_SUB_SESSION_SECRET=一串足够长的随机字符串
```

生成一串可用密钥：

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 项目结构

```text
app/
  api/
    auth/status/route.ts        检查登录态
    auth/login/start/route.ts   生成扫码登录二维码
    auth/login/poll/route.ts    轮询扫码登录结果并写入加密 Cookie
    auth/logout/route.ts        清除登录态
    subtitles/route.ts          获取字幕
  page.tsx                      页面入口
components/                     页面组件
lib/local-api.ts                前端 API 类型和请求工具
lib/server/bilibili.ts          B 站接口、字幕解析、SRT 渲染
lib/server/session.ts           加密 HttpOnly Cookie 会话
vercel.json                     Vercel 部署配置
```

## 常用命令

```powershell
pnpm typecheck
pnpm build
pnpm dev
```

## 部署到 Vercel

1. 登录 `https://vercel.com`。
2. 点 `Add New...`，选 `Project`。
3. 选择 GitHub 仓库 `Albert-PZY/BiliSub`。
4. Framework 保持 `Next.js`。
5. Root Directory 保持 `./`。
6. Install Command 使用 `pnpm install --frozen-lockfile`。
7. Build Command 使用 `pnpm build`。
8. 添加环境变量 `BILI_SUB_SESSION_SECRET`。
9. 点 `Deploy`。

以后合并到 `main`，Vercel 会自动重新部署。

## 注意

GitHub Pages 不能跑服务端接口，所以这个项目不再用 GitHub Pages 作为主部署方式。完整功能需要部署到 Vercel 或其他支持 Next.js 服务端运行的平台。

## 提交与发布

提交信息遵循约定式提交，详见 `docs/git-commit-guidelines.md`。

Release Please 只创建发布 PR，不会因为普通提交直接打正式 tag。等多个变更积累到稳定发布点后，再合并发布 PR。

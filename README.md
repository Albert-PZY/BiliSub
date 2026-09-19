<div align="center">
  <img src="public/readme-hero.svg" alt="BiliAISub：从视频链接到可编辑字幕的工作台结构示意" width="100%" />

  <p>
    <img alt="Vite 6" src="https://img.shields.io/badge/Vite-6-7C5CFF?logo=vite&logoColor=white" />
    <img alt="React 19" src="https://img.shields.io/badge/React-19-7C5CFF?logo=react&logoColor=white" />
    <img alt="TypeScript 5" src="https://img.shields.io/badge/TypeScript-5-5A6089?logo=typescript&logoColor=white" />
    <img alt="pnpm 11" src="https://img.shields.io/badge/pnpm-11-FF5C8A?logo=pnpm&logoColor=white" />
  </p>

  <p><strong>把 B 站官方 AI 字幕整理成可编辑、可导出的工作区。</strong></p>
  <p>静态 Vite + React 前端 · 独立 Next.js API · NDJSON 流式反馈 · 浏览器内校对</p>
  <p>
    <a href="#快速开始">快速开始</a>
    ·
    <a href="#部署">部署</a>
    ·
    <a href="#架构">架构</a>
  </p>
</div>

### 项目简介

BiliAISub 用于整理 B 站视频的官方 AI 字幕。输入 BV 号、完整视频链接或 `b23.tv` 短链接后，应用会解析视频与分 P；单 P 视频自动进入字幕获取，多 P 视频由使用者选择范围。字幕结果会逐条进入列表，可以切换语言、校对内容，并导出为 TXT、SRT 或 JSON。

项目由两个可以分别部署的部分组成：

- **静态前端**：根目录的 Vite + React + TypeScript 应用，构建到 `dist/`，适合 GitHub Pages 或其他静态托管。
- **独立 API**：`backend/` 下的 Next.js Node.js 项目，负责 B 站请求、扫码登录、会话保护、视频解析和 NDJSON 字幕流。

前端不会直接请求 B 站，也不会把 B 站登录 Cookie 暴露给浏览器。部署前端时必须通过 `VITE_API_BASE_URL` 指向独立 API；Pages workflow 会在缺少 API 地址时提前失败。

### 工作流

<div align="center">
  <img src="public/diagrams/workflow.svg" alt="BiliAISub 字幕工作流：扫码登录、解析视频、选择分 P、流式获取、在线校对和导出" width="100%" />
</div>

<p align="center"><sub>源文件：<a href="docs/diagrams/workflow.puml">docs/diagrams/workflow.puml</a> · SVG：<a href="public/diagrams/workflow.svg">public/diagrams/workflow.svg</a></sub></p>

### 功能边界

| 能力 | 当前实现 |
| --- | --- |
| 视频输入 | 每批最多 20 个视频，支持 BV 号、完整链接和 `b23.tv` 短链接，输入会自动去重 |
| 分 P 处理 | 单 P 自动处理；多 P 视频支持搜索、全选、清空和按范围获取 |
| 字幕反馈 | API 通过 NDJSON 逐项返回结果，完成项会立即进入任务列表 |
| 多语言 | 支持全部语言、简体中文、繁体中文、英语、日语和韩语请求，并可在编辑区切换轨道 |
| 在线校对 | 直接编辑当前语言内容，可以恢复原文；编辑不会回写 B 站 |
| 文件导出 | 支持当前语言、当前视频和全部成功结果三种范围，输出 TXT、SRT、JSON |
| 失败隔离 | 单个视频、分 P 或语言轨道失败时保留其他结果，并显示对应错误 |

### 架构

<div align="center">
  <img src="public/diagrams/architecture.svg" alt="BiliAISub 架构：GitHub Pages 静态前端通过 API 访问独立 Next.js 服务，再由服务端请求 Bilibili" width="100%" />
</div>

<p align="center"><sub>源文件：<a href="docs/diagrams/architecture.puml">docs/diagrams/architecture.puml</a> · SVG：<a href="public/diagrams/architecture.svg">public/diagrams/architecture.svg</a></sub></p>

```text
浏览器
  ├─ GitHub Pages 提供 Vite dist/
  └─ fetch /api/* ──> 独立 Next.js API（Vercel，Root Directory: backend）
                           └─ 服务端携带 B 站 Cookie 请求 Bilibili
```

前端负责页面、工作区状态、字幕模型和文件下载；`backend/` 负责认证、视频解析、字幕获取、输入限制、CORS 和加密会话。

### 会话与安全边界

- **同源部署**：前端和 API 使用同一个 origin 时，会话只写入 `bili_ai_sub_session` HttpOnly Cookie。JavaScript 只能读取账号摘要，不能读取 Cookie。
- **跨域 Pages 部署**：GitHub Pages 与 API 不同源时，可信白名单来源会收到加密 session token。前端只把它放入当前标签页的 `sessionStorage`，后续通过 `Authorization: Bearer <token>` 请求 API。
- **令牌范围**：session token 不是 B 站 Cookie，服务端才会解密其中的 B 站 Cookie；会话按最近更新时间滚动，最长 30 天。关闭标签页后，前端的 `sessionStorage` 会被清除。
- **来源控制**：API 只对精确匹配的 origin 返回 CORS 响应，生产环境必须使用 HTTPS。不要把 `SESSDATA`、B 站 Cookie、API 密钥或 session token 提交到仓库。

启动后的工作台规格页位于 `#/specs`，内容只描述当前实现中的限制、状态顺序和部署分工。

### 快速开始

#### 环境要求

- Node.js 22.x
- pnpm 11.x

#### 本地双进程

根目录 Vite 前端使用 `3000` 端口，独立 API 使用 `3001` 端口。需要同时启动两个进程：

```bash
pnpm install --frozen-lockfile
pnpm dev
```

另开一个终端：

```bash
pnpm dev:api
```

打开 <http://localhost:3000>。开发服务器会把 `/api` 代理到 `http://localhost:3001`，因此本地前端环境变量可以留空。

#### 环境变量

建议分别创建根目录 `.env.local` 和 `backend/.env.local`。只有带 `VITE_` 前缀的值会被注入浏览器。

根目录 `.env.local`：

```dotenv
# 本地留空，Vite 会代理到 localhost:3001
VITE_API_BASE_URL=
# 项目站使用 /仓库名/；自定义域名或 User Pages 使用 /
VITE_BASE_PATH=/
```

`backend/.env.local`：

```dotenv
# 生产环境必须设置为至少 32 字节的随机值
BILI_SUB_SESSION_SECRET=
# 允许访问 API 的前端 origin，多个值使用英文逗号分隔
BILI_SUB_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:4173
```

可以使用下面的命令生成会话密钥：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

完整示例见 [`.env.example`](.env.example)。服务端变量只放在 API 部署环境中，不要复制到前端构建环境。

### 部署

前端与 API 分开发布。先部署 API，再把 API 地址交给 Pages workflow。

#### 部署独立 API

1. 在 Vercel 导入仓库。
2. 将 **Root Directory** 设置为 `backend`，不要把仓库根目录作为 Next.js 项目。
3. 保持 `backend/vercel.json` 作为 API 项目配置，构建命令为 `pnpm build`。
4. 在 Vercel 环境变量中设置 `BILI_SUB_SESSION_SECRET`，并把实际前端 origin 写入 `BILI_SUB_ALLOWED_ORIGINS`。
5. 部署后记录 API 地址，例如 `https://your-api.example.com`。这个地址只用于 `VITE_API_BASE_URL`，不是前端页面地址。

#### 部署 GitHub Pages

仓库提供 [`.github/workflows/pages.yml`](.github/workflows/pages.yml)，会安装 workspace 依赖、检查前端类型、构建 `dist/` 并发布到 GitHub Pages。

1. 在 GitHub 仓库的 **Settings → Pages** 中选择 **GitHub Actions**。
2. 在 **Settings → Secrets and variables → Actions → Variables** 中添加必填变量 `BILI_SUB_API_BASE_URL`，值为独立 API 地址，不带末尾 `/`。
3. 项目站默认使用 `/<repository-name>/`。自定义域名、User Pages 或根路径部署时，可添加 `BILI_SUB_BASE_PATH=/`；该值必须以 `/` 开头并以 `/` 结尾。
4. 推送到 `main` 或手动运行 `Deploy GitHub Pages` workflow。
5. 把实际 Pages origin（例如 `https://owner.github.io`，不含仓库路径）加入 API 的 `BILI_SUB_ALLOWED_ORIGINS`，然后重新部署 API。

### 常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm install --frozen-lockfile` | 按锁文件安装两个 workspace 的依赖 |
| `pnpm dev` | 启动 Vite 开发服务器 |
| `pnpm dev:api` | 启动 `backend/` 的 Next.js API |
| `pnpm typecheck` | 检查静态前端 TypeScript |
| `pnpm build` | 构建静态前端到 `dist/` |
| `pnpm start` | 使用 `vite preview` 预览静态构建 |
| `pnpm typecheck:api` | 生成 Next.js 路由类型并检查 API TypeScript |
| `pnpm build:api` | 构建独立 Next.js API |

### 项目结构

```text
.
├─ src/                         Vite + React 静态前端
│  ├─ page.tsx                  工作台页面与交互编排
│  ├─ specs.tsx                 #/specs 规格视图
│  ├─ components/               登录、输入、分 P、编辑器、导出与 UI
│  ├─ hooks/use-subtitle-workspace.ts
│  └─ lib/                      API 客户端、字幕模型、限制与资源路径
├─ backend/                     独立 Next.js API
│  ├─ app/api/auth/             登录开始、轮询、状态与退出
│  ├─ app/api/videos/resolve/   视频和分 P 解析
│  ├─ app/api/subtitles/        字幕获取与 NDJSON 流
│  ├─ lib/cors.ts               CORS 响应与跨域令牌边界
│  ├─ lib/server/               B 站客户端、请求校验与会话
│  └─ vercel.json               API 的 Vercel 配置
├─ public/                      静态资源与 README 图表
├─ docs/diagrams/               PlantUML 源文件
├─ .github/workflows/pages.yml  构建并发布 dist/ 到 GitHub Pages
├─ index.html                   Vite HTML 入口
├─ vite.config.ts               Vite、base path 与本地 API proxy
├─ package.json                 根 workspace 与前端脚本
└─ pnpm-workspace.yaml          根包与 backend workspace
```

### 限制与注意事项

- 单批最多处理 20 个视频，一次字幕获取最多处理 100 个分 P；前端提示限制，API 会再次校验。
- 字幕是否可用取决于 B 站是否为具体视频返回官方 AI 字幕。本项目不生成，也不保证字幕内容。
- 项目不保存字幕任务数据库，不提供后台队列或长期账号托管；刷新或关闭页面不会把编辑内容同步到服务端。
- 请遵守 B 站服务条款、隐私规则和内容版权要求，只处理有权访问和使用的视频。
- 导出内容的准确性、完整性和后续使用责任由使用者承担。

### 图表源文件

PlantUML 源文件位于 [`docs/diagrams/`](docs/diagrams/)，对应 SVG 位于 [`public/diagrams/`](public/diagrams/)。仓库不包含 `plantuml.jar`，安装 Java 和 PlantUML 后，可以在根目录运行：

```bash
java -Djava.awt.headless=true -jar plantuml.jar -charset UTF-8 -tsvg -o ../../public/diagrams docs/diagrams/workflow.puml docs/diagrams/architecture.puml
```

重新生成后请检查 SVG 的 `title`、`desc`、文字大小、颜色和 `viewBox`，并确认没有引入远程字体、脚本或 `foreignObject`。

### 相关链接

- [当前实现规格](src/specs.tsx)
- [GitHub Actions Pages workflow](.github/workflows/pages.yml)
- [Git 提交约定](docs/git-commit-guidelines.md)
- [项目仓库](https://github.com/Albert-PZY/BiliSub)

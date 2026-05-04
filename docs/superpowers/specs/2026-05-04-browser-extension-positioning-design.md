# 浏览器插件竞品定位与产品方向

日期：2026-05-04
状态：draft
目标：基于当前仓库能力，判断 `BiliAISub` 是否适合做成浏览器插件，并明确推荐定位与第一阶段产品边界。

## 结论

这个项目适合做成浏览器插件，但不适合只做成一个“点一下下载 SRT”的极简按钮。

更合适的形态是：

- `Bilibili 专用侧边栏插件`
- `可直接发布到 Chrome Web Store 和 Edge Add-ons`
- 以 `字幕读取 + 列表浏览 + 时间跳转 + 导出 + 轻量 AI 处理` 为核心
- 强调 `本地优先`、`不托管账号`、`不做云端登录态`

推荐定位一句话：

> 一个面向 B 站知识视频和语言学习场景的字幕工作台，而不是单次下载器。

## 当前仓库已经具备的能力

从现有代码看，这个仓库的核心并不是“生成字幕”，而是“在已登录 B 站账号的前提下，稳定获取 AI 字幕并导出多种格式”。

已存在的稳定能力：

- 二维码登录与轮询登录态
- 本地持久化登录 Cookie
- 通过 `BV` 号或视频链接解析视频信息
- 获取 AI 字幕轨并导出为 `text / srt / raw-json`
- 暴露本地 HTTP API，适合被别的前端壳复用

对应代码入口：

- CLI 入口：[src/bili_ai_sub/cli.py](/F:/BiliAISub/src/bili_ai_sub/cli.py:15)
- 字幕抓取主流程：[src/bili_ai_sub/bilibili.py](/F:/BiliAISub/src/bili_ai_sub/bilibili.py:141)
- 本地会话存储：[src/bili_ai_sub/store.py](/F:/BiliAISub/src/bili_ai_sub/store.py:21)
- 本地 API 服务：[src/bili_ai_sub/api_service.py](/F:/BiliAISub/src/bili_ai_sub/api_service.py:10)
- HTTP 路由层：[src/bili_ai_sub/http_api.py](/F:/BiliAISub/src/bili_ai_sub/http_api.py:11)

这意味着插件路线有两种实现方式：

1. 纯扩展内实现：直接在插件里读页面环境、请求字幕接口、自己管理权限和状态。
2. 扩展前端 + 本地服务：插件负责 UI 和页面交互，本仓库继续作为本地能力引擎。

如果只考虑复用现有代码，第二种更稳。

但如果目标是“直接发布到插件市场给普通用户安装”，第一种更适合作为第一版主路径，因为它不要求用户额外安装或启动本地服务。

该实现方向已确认：

- 第一版采用 `B 方案`
- 以字幕获取稳定性优先
- 允许申请受限范围内的 Bilibili 相关扩展权限

## 竞品盘点

以下信息基于 2026-05-04 可访问页面整理。

| 产品 | 成熟度信号 | 核心定位 | 与本项目重合点 | 判断 |
| --- | --- | --- | --- | --- |
| vCaptions | Chrome 商店显示 `20,000 users`、`4.7/175 ratings`、更新于 `2025-12-07` | 任意网站视频字幕列表、翻译、章节、AI 总结 | 字幕列表、导出、AI 处理 | 成熟头部，方向更平台化，不是纯 B 站 |
| 一字幕 | Chrome 商店显示 `5,000 users`、`4.6/45 ratings`、更新于 `2026-05-01` | 语言学习插件，支持 YouTube / Bilibili / 百度网盘 / 本地字幕 | 双语字幕、下载、学习辅助 | 成熟度中高，学习属性很强 |
| BiliBili 字幕提取器 | Chrome 商店显示 `6,000 users`、`5.0/10 ratings`、更新于 `2025-12-10` | 一键提取 B 站 AI 字幕并导出 TXT/SRT | 和当前仓库最直接重合 | 已验证需求存在，但护城河弱 |
| AI课代表 | Chrome 商店显示 `8,000 users`、`4.4/29 ratings`、更新于 `2024-11-01` | B 站学习助手，强调视频总结、字幕搜索、提问 | 字幕搜索、总结 | 更偏 AI 学习助手，不是导出工具 |
| BiliStudy | Chrome 商店页面可见，更新于 `2025-12-31` | B 站学习助手，含字幕获取、AI 总结、笔记管理 | 字幕列表、AI 总结、笔记 | 方向接近“学习工作台”，但规模尚早期 |
| 哔哔君 / bilibili-subtitle | GitHub 显示 `1k stars`、`94 forks`，开源版停止更新并升级为 vCaptions | 字幕列表、下载、总结、翻译 | 证明“字幕面板”方向被验证过 | 说明成熟产品最终会从单站点走向多站点 |

## 市场判断

### 1. “能不能做”

能做，而且需求已被证明存在。

证据不是“有没有人提过这个想法”，而是已经存在多类插件：

- 极简提取器
- 学习辅助型字幕面板
- AI 总结型 B 站助手
- 跨站点视频字幕工作台

这说明“在看视频时直接消费字幕数据”已经是成熟用户心智。

### 2. “做成什么更有机会”

机会不在“再做一个字幕下载器”，而在“做一个边界清晰、体验更稳、隐私姿态更好的 B 站字幕工作台”。

原因如下：

- 纯下载器功能太薄，容易被已有插件覆盖。
- 跨站点通用字幕平台会直接撞上 `vCaptions`、`一字幕` 这类成熟产品。
- 当前仓库天然强项是 `B 站登录态 + 字幕提取稳定性 + 本地 API`，这些更适合做垂直深耕。

### 3. “为什么不建议第一版直接做成跨站平台”

因为当前代码完全围绕 Bilibili 登录态和接口组织：

- 登录流程是 B 站二维码登录
- Cookie 白名单也是 B 站字段
- 字幕抓取依赖 B 站视频与字幕接口

如果一开始就追求 YouTube、网盘、本地文件、任意网站，会把产品从“可交付”拉回“半成品平台”。

## 推荐定位

推荐做成：`B 站字幕工作台`

不是：

- 纯下载器
- 通用翻译插件
- 云端 AI 总结 SaaS

而是：

- 专注 B 站视频页
- 打开视频就能看到字幕侧边栏
- 用户围绕字幕做跳转、复制、导出、搜索和轻量总结

### 推荐目标用户

- 看技术教程、课程、讲座、科普视频的人
- 想从长视频里快速定位知识点的人
- 需要把视频字幕整理到 Obsidian、Notion、知识库的人
- 需要导出字幕做二次处理的人

### 推荐核心价值

- 比“复制字幕”更快
- 比“看原视频”更可控
- 比“把 Cookie 交给第三方网站”更安全

## 不同定位方案对比

### 方案 A：极简字幕提取器

形态：

- 点击插件图标
- 自动提取当前视频字幕
- 导出 TXT / SRT

优点：

- 开发最快
- 学习成本最低
- 最容易上线第一版

缺点：

- 与 `BiliBili 字幕提取器` 高度重合
- 用户很难形成长期留存
- 名字、品牌和后续功能扩展空间都偏弱

判断：

可作为 MVP 的能力子集，但不应成为最终定位。

### 方案 B：字幕工作台侧边栏

形态：

- 在 B 站视频页启用侧边栏
- 展示完整字幕列表
- 点击字幕可跳转时间点
- 支持搜索、复制、导出、生成摘要

优点：

- 与当前仓库能力高度匹配
- 更接近高频工作流
- 比单次下载器更容易形成产品认知

缺点：

- 前端交互复杂度更高
- 需要设计状态同步和页面适配

判断：

这是推荐路线。

### 方案 C：B 站学习助手

形态：

- 字幕工作台 + 笔记 + 收藏 + AI 问答 + 复习

优点：

- 商业化空间和用户时长更强
- 与 AI 学习场景更贴近

缺点：

- 容易直接撞上 `一字幕`、`AI课代表`、`BiliStudy`
- 范围膨胀过快
- 第一版做不好会显得臃肿

判断：

适合作为第二阶段，而不是第一阶段。

## 插件市场发布约束与 MVP

### 插件市场发布约束

既然目标是直接发布到 Chrome Web Store 和 Edge Add-ons，第一版设计必须满足以下约束：

- 安装后即可使用，不依赖本地 Python 环境
- 不要求用户单独启动守护进程或本地 HTTP 服务
- 权限范围尽量收窄，避免申请与产品定位无关的高敏感权限
- 不内置任何服务端密钥
- 所有 AI 能力必须基于用户自行配置的 API Key

这会直接影响技术选型：

- 面向公开分发，优先推荐 `纯 MV3 扩展`
- 本地桥接只适合作为开发阶段或高级用户模式，不应作为第一版主路径

第一阶段只做下面这些：

1. 在 `bilibili.com/video/*` 启用插件
2. 读取当前视频 BV 号
3. 识别当前账号是否已登录且字幕可用
4. 打开侧边栏展示字幕列表
5. 支持点击字幕跳转时间点
6. 支持全文复制
7. 支持导出 `TXT / SRT`
8. 支持简单关键词搜索
9. 支持一键生成“视频摘要”

明确不做：

- 多平台支持
- 云端账号体系
- 云端托管 Cookie
- 笔记系统
- 社区、收藏夹、同步
- 重型 AI 对话工作区

## 视频摘要怎么做

“一键生成视频摘要”我不建议用规则算法硬做，也不建议第一版就在插件里跑本地大模型。

更实际的方案有三种：

### 方案 A：纯规则摘要

输入：

- 字幕全文
- 时间轴分段

做法：

- 统计高频词
- 按时间窗口抽关键句
- 合并成若干条摘要

优点：

- 无模型成本
- 无外部依赖
- 实现简单

缺点：

- 摘要质量通常一般
- 很容易变成“字幕摘抄”
- 对教程、讲座类长视频不够稳

判断：

适合兜底，不适合作为主方案。

### 方案 B：云端 LLM 摘要

输入：

- 标题
- 视频链接
- 字幕全文或分块字幕

做法：

- 先按 token 或时长把字幕切块
- 先做分块摘要
- 再做总摘要
- 最终输出结构化结果

推荐输出结构：

- `summary`
- `key_points`
- `timeline_sections`
- `action_items`
- `keywords`

优点：

- 摘要质量最高
- 适合知识视频
- 容易扩展成章节总结、提纲、复习卡片

缺点：

- 有模型调用成本
- 需要处理长文本切块
- 需要处理用户对隐私和 API Key 的顾虑

判断：

这是最适合作为主方案的路线。

### 方案 C：混合方案

做法：

- 本地先做清洗、去重、切块、关键词预提取
- 再把压缩后的字幕片段送给 LLM
- 返回结构化摘要

优点：

- 成本更低
- 延迟更稳
- 更适合长视频

缺点：

- 工程复杂度高于纯规则或纯云摘要

判断：

这是推荐的工程实现方案。

### 推荐实现

推荐第一版采用：`本地预处理 + 用户自配 OpenAI 兼容 LLM`

原因：

- 你现在已有的核心能力是“稳定拿到字幕”，不是“本地模型推理”。
- 浏览器插件里直接跑本地模型，包体、性能和兼容性都不划算。
- 面向插件市场公开分发时，最稳的是让用户自己提供 API Key，而不是你托管模型调用。

我建议的摘要链路：

1. 插件获取字幕 `segments`
2. 本地把字幕按时间窗或 token 数切块
3. 先生成块摘要
4. 再合并成总摘要
5. 输出固定 JSON 结构给侧边栏 UI 渲染

如果使用 LLM API，优先要求它返回结构化 JSON，而不是自由文本，这样插件端更容易稳定展示。

### Provider 策略

第一版应只支持两个 provider：

- `OpenAI`
- `阿里云百炼`

两者都走 `OpenAI 兼容` 的调用方式，但第一版不要放开“任意自定义域名”的 provider 配置。

原因：

- 这能明显降低插件市场审核风险
- 扩展所需的 host permissions 可以保持在已知官方域名范围内
- 能避免插件沦为“向任意外部域名发送用户密钥”的高风险形态

### 调用协议建议

第一版摘要能力建议统一使用 `Chat Completions` 兼容协议，而不是优先使用 `Responses`。

原因：

- OpenAI 官方仍然支持 `POST /v1/chat/completions`
- 阿里云百炼官方文档明确给出了 OpenAI 兼容的 `chat/completions` 调用方式
- 你的目标是“OpenAI 与百炼共用一套调用抽象”，此时 `chat/completions` 的跨 provider 兼容性更稳

可配置字段建议限制为：

- `provider`
- `apiKey`
- `baseUrl`
- `model`
- `temperature`
- `maxOutputTokens`

其中：

- `OpenAI` 的 `baseUrl` 固定为 `https://api.openai.com/v1`
- `阿里云百炼` 提供官方域名预设
- API Key 存储在扩展本地存储中，不放入同步存储
- 第一版接受 API Key 不做额外加密，由用户自行保管本机环境安全

该约束已确认：

- API Key 使用扩展本地存储
- 第一版不接入浏览器同步存储
- 第一版不增加额外加密层

### 模型配置建议

第一版模型配置应尽量简单，不引入复杂的 provider 能力探测：

- 用户先选择 `OpenAI` 或 `阿里云百炼`
- 用户手动填写 `model`
- 设置页提供 `测试连接`
- 只有测试通过后，摘要功能才进入可用状态

这样做的原因：

- 不把模型可用性判断写死在插件里
- 避免维护 provider 侧经常变化的模型列表
- 让同一套 OpenAI 兼容调用逻辑保持稳定

### 摘要输出语言策略

第一版采用：`固定输出简体中文摘要`

原因：

- 设置项更少，用户理解成本最低
- 更适合当前项目的中文用户场景
- 有利于减少 prompt 分支和测试面

该约束按默认方案确认：

- 第一版摘要默认输出简体中文
- 第一版不提供“跟随原字幕语言”
- 第一版不提供“用户自选摘要语言”

### 摘要功能失效策略

你已经明确要求“LLM 功能不可用，则摘要功能也不可用”，这应作为产品规则写死：

- 未配置 API Key：摘要入口禁用
- API Key 校验失败：摘要入口禁用，并显示错误原因
- provider 返回余额、限流、鉴权错误：摘要入口禁用，提示用户修复配置
- 不提供规则摘要兜底

这是一种 `fail-closed` 策略，符合你的产品意图，也避免用户误以为自己拿到的是“真正的 AI 摘要”。

## 浏览器兼容策略

目标应改成：`Chrome + Edge 共用一套 Chromium MV3 扩展代码`

原因：

- Microsoft Edge 官方文档明确说明，Chrome 扩展 API 和 manifest keys 与 Edge 基本兼容，通常只需要最少修改即可移植。
- Edge 也支持扩展在侧边栏中运行。

这意味着第一阶段不要写任何只服务 Chrome 单一家商店的实现细节。

## 推荐技术路线

推荐第一阶段采用：`Chrome/Edge 通用 MV3 侧边栏插件 + 纯扩展实现字幕能力 + 用户自配 LLM`

理由：

- Chrome 官方 `sidePanel` API 适合做常驻侧边栏式工作台，Edge 侧边栏扩展也兼容这套思路。
- 插件市场公开分发时，纯扩展形态比“本地伴生服务”更容易被普通用户接受。
- 用户自配 LLM API Key，避免你承担代调用成本和服务端风控。
- 账号数据仍留在用户浏览器环境中，不需要云端托管登录态。

### 纯扩展模式下的核心实现建议

字幕获取主路径按 `B 方案` 执行：

1. 为 `*.bilibili.com/*` 申请受限的 host permissions
2. 扩展直接请求 B 站相关页面或接口，优先走更稳定的数据获取链路
3. 内容脚本与侧边栏负责读取当前视频上下文并联动时间跳转
4. 如果仅靠 host permissions 仍无法稳定获取字幕，再申请 `cookies` 权限作为次级手段

这样做的目标是：在稳定性优先前提下，仍尽量把权限控制在 B 站相关范围内。

### 为什么不建议第一版开放“任意 OpenAI 兼容地址”

如果允许用户输入任意 `baseUrl`，你就会碰到两个问题：

- 扩展需要更宽泛的外部访问权限
- 插件市场会更关注“扩展可将用户密钥发送到任意第三方域名”这一风险

所以第一版应优先使用：

- OpenAI 官方域名
- 阿里云百炼官方域名

后续如果确实要开放任意 OpenAI 兼容地址，应该作为高级设置，并单独设计权限与风险提示。

该约束已确认：

- 第一版接受只支持 OpenAI 官方域名与阿里云百炼官方域名预设
- 第一版不开放任意自定义 `baseUrl`

### `chrome.cookies` 在 B 方案里的位置

从 Chrome 官方文档看，读取 Cookie 需要声明 `cookies` 权限和相应 host permissions。技术上可行，但产品上会带来明显问题：

- 权限敏感，安装时用户更警惕
- 商店审核与隐私说明更麻烦
- 后续如果要支持多浏览器，Cookie 策略差异更大

所以在 `B` 方案里，`cookies` 不应作为默认第一步，而应作为“host permissions 方案不够稳定时再启用”的次级手段：

- 先用受限 Bilibili 域名权限完成主链路
- 只有在确实需要识别受保护登录态时再读取最小必要 Cookie
- 仍然不上传 Cookie，不做云端托管

这样既符合你选的稳定性优先，也尽量维持插件市场公开分发的权限最小化原则。

## 产品差异化建议

如果要避免落入“又一个 B 站字幕插件”，建议把差异化集中在下面三点：

### 1. 本地优先

- 不上传账号 Cookie
- 不要求把视频链接提交到陌生第三方站点
- 本地保存结果，可直接喂给个人知识库

### 2. 面向知识视频

- 优先优化教程、课程、科普、讲座类视频
- 摘要、关键词、章节感更重要
- 不把产品定位成泛娱乐插件

### 3. 可接入个人工作流

- 导出 `TXT / SRT / JSON`
- 为后续接 Obsidian、Notion、LLM Agent、本地知识库留接口

## 命名方向建议

如果后续要改名，建议避免下面两类名字：

- 太像脚本仓库：`BiliAISub`、`bili-sub-fetcher`
- 太像泛 AI 插件：`BiliGPT Helper`

更适合的命名方向：

- 工具台型：`字幕台`、`片语台`、`字流`
- 学习型：`课幕`、`片读`、`视频课代表`
- 偏专业型：`Bili Transcript`、`B 站字幕工作台`

如果后续确认最终定位是“B 站字幕工作台”，命名应服务于这个心智，而不是服务于底层实现。

## 下一步建议

最合理的下一步不是直接重命名，而是先写一份插件 MVP 规格，再决定名称。

推荐顺序：

1. 固定产品定位：`B 站字幕工作台`
2. 固定插件形态：`Chrome + Edge 通用 MV3 侧边栏`
3. 固定发布策略：`Chrome Web Store + Edge Add-ons`
4. 固定摘要方案：`用户自配 OpenAI/百炼 API Key + Chat Completions 兼容协议`
5. 固定失效规则：`无可用 LLM 即无摘要功能`
6. 固定 MVP 边界：字幕列表、搜索、跳转、导出、摘要
7. 再做命名筛选

## 参考资料

- Chrome `sidePanel` 官方文档：https://developer.chrome.com/docs/extensions/reference/sidePanel/
- Chrome `cookies` 官方文档：https://developer.chrome.com/docs/extensions/reference/api/cookies
- Chrome `storage` 官方文档：https://developer.chrome.com/docs/extensions/reference/api/storage
- OpenAI Chat Completions API 参考：https://platform.openai.com/docs/api-reference/chat
- OpenAI Models 文档：https://platform.openai.com/docs/models
- 阿里云百炼 OpenAI 兼容文档：https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope
- Microsoft Edge 侧边栏扩展文档：https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/sidebar
- Microsoft Edge Chrome 扩展移植文档：https://learn.microsoft.com/zh-cn/microsoft-edge/extensions/developer-guide/port-chrome-extension
- Microsoft Edge 扩展 API 支持列表：https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/api-support
- `vCaptions – Video Caption List`：https://chromewebstore.google.com/detail/vcaptions-%E2%80%93-video-caption/bciglihaegkdhoogebcdblfhppoilclp
- `一字幕 - 视频双语字幕插件 | 免费`：https://chromewebstore.google.com/detail/%E4%B8%80%E5%AD%97%E5%B9%95-%E8%A7%86%E9%A2%91%E5%8F%8C%E8%AF%AD%E5%AD%97%E5%B9%95%E6%8F%92%E4%BB%B6-%E5%85%8D%E8%B4%B9/fjbegfkmkcjknjkkcebnejcpdchpadpc
- `BiliBili 字幕提取器`：https://chromewebstore.google.com/detail/bilibili-%E5%AD%97%E5%B9%95%E6%8F%90%E5%8F%96%E5%99%A8/mmekbkdnolpcbgbedcibicjhigkfdojg
- `AI课代表 - B站学习助手, 视频总结, 字幕列表, GPT-4`：https://chromewebstore.google.com/detail/ai%E8%AF%BE%E4%BB%A3%E8%A1%A8-b%E7%AB%99%E5%AD%A6%E4%B9%A0%E5%8A%A9%E6%89%8B-%E8%A7%86%E9%A2%91%E6%80%BB%E7%BB%93-%E5%AD%97%E5%B9%95%E5%88%97%E8%A1%A8-gp/jgilkmapjeaikiboajahmeiadceioobc
- `BiliStudy-B站学习助手`：https://chromewebstore.google.com/detail/bilistudy-b%E7%AB%99%E5%AD%A6%E4%B9%A0%E5%8A%A9%E6%89%8B/kncfokfekfndeobcngobehnahnjlckgc
- `IndieKKY/bilibili-subtitle`：https://github.com/IndieKKY/bilibili-subtitle

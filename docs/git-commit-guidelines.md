# Git 提交与版本发布规范

本项目采用 [约定式提交 1.0.0](https://www.conventionalcommits.org/zh-hans/v1.0.0/) 管理提交信息，并通过 Release Please 自动生成版本 PR、CHANGELOG、GitHub Release 和版本标签。

## 提交格式

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

常用写法：

```text
feat: add local subtitle web app
fix(subtitle): preserve all language tracks
docs: update setup guide
ci: deploy frontend to github pages
feat!: change session file schema
```

## type 取值

- `feat`: 新功能或新增用户可感知能力。
- `fix`: 修复 bug 或异常行为。
- `docs`: 只修改文档。
- `test`: 只新增或修改测试。
- `refactor`: 不改变外部行为的代码整理。
- `perf`: 性能优化。
- `ci`: GitHub Actions、发布流水线等 CI/CD 变更。
- `build`: 构建系统、打包配置、依赖范围变更。
- `chore`: 仓库维护、脚手架、非业务性调整。
- `style`: 只改格式，不改语义。
- `revert`: 回滚历史提交。

## 提交粒度

- 不同功能分开提交，业务能力、CI、文档不要混在同一个提交里。
- 每个提交只表达一个清晰意图，描述使用英文小写开头，末尾不加句号。
- 不提交本地登录态、二维码、自测字幕、依赖目录、构建缓存和临时验证文件。
- 涉及行为变化时，提交前至少运行后端测试、前端类型检查和前端构建。

## 版本号规范

本项目使用 SemVer：`MAJOR.MINOR.PATCH`。

- `fix` 对应 `PATCH`。
- `feat` 对应 `MINOR`。
- `!` 或 `BREAKING CHANGE:` 对应 `MAJOR`。
- `docs`、`test`、`refactor`、`ci`、`build`、`chore` 默认不触发版本号提升，除非带有破坏性变更标记。

## 发布规则

- 不因单个普通功能提交立即手动打 tag。
- 多个 PR 积累到一个稳定发布点后，合并 Release Please 创建的发布 PR。
- 合并发布 PR 后，GitHub Actions 会创建精确 tag：`vX.Y.Z`。
- 每次发布会同步维护移动 tag：`vX` 和 `vX.Y`。
- 是否发布由维护者在合并 Release Please PR 时决定，而不是每次功能提交自动决定。

## 推荐验证

提交前运行：

```powershell
uv run python -m pytest tests -q
pnpm --dir frontend exec tsc --noEmit
pnpm --dir frontend build
git diff --check
```

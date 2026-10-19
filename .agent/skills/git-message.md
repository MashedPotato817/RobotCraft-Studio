---
name: git-message
description: 规范本仓库 Git commit、merge 和同步 main 的提交信息，在撰写或检查 Git 提交信息时使用。
---

# Git 提交信息规范

沿用 `git-workflow` 技能中的 MAA 风格消息要求。

## Commit 消息格式

采用 MAA 风格（参考 MaaAssistantArknights）：`<类型>(<可选作用域>): <中文主体>`

- 类型前缀全小写英文、无标点（禁止 `fix.`、`feat!` 之类写法）：
  - `feat` 新功能
  - `fix` 修复
  - `docs` 文档
  - `chore` 杂项 / 维护
  - `style` 样式 / 界面
  - `refactor` 重构
  - `test` 测试
  - `perf` 性能
  - `ci` 持续集成 / 构建脚本
  - 无法归入以上任何类型时，一律用 `chore`
- 可选作用域（全小写英文，小括号内）：如 `fix(server): ...`、`docs(readme): ...`
- 主体用中文描述，关键名词保留英文。
- `git revert` 生成的 `Revert "..."` 保持原样，不要改写。

示例：

- `feat: 新增导出功能，支持 PDF 格式`
- `fix: 修复文件编码检测在 UTF-16 下失效的问题`
- `fix(server): 修复中文输入法下快捷键冲突`
- `docs: 补充开发日志与 README`

## 合并与同步消息

- merge 消息不用默认的 `Merge branch 'xxx' into main`，手动写一条规范格式消息（相当于 PR 标题），格式同 commit：`<类型>(<可选作用域>): <中文主体>`，正文按需分点说明本次合并内容。
- 把 `main` 最新改动同步到工作分支时，用 `chore(branch): 同步main最新改动`。

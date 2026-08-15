# 项目配置

本项目使用外部技能包来增强开发体验。

## 技能引用

技能包位置：`D:\Skill\.claude\skills`

### 可用的工程技能（engineering）

- **setup-matt-pocock-skills** - 设置 Matt Pocock 的 TypeScript 技能和工作流
- **code-review** - 代码审查工具
- **codebase-design** - 代码库设计指导
- **diagnosing-bugs** - 诊断和修复 bug
- **domain-modeling** - 领域建模工具
- **implement** - 实现功能
- **prototype** - 快速原型开发
- **research** - 代码库研究
- **tdd** - 测试驱动开发
- **triage** - 问题分类
- **wayfinder** - 代码库导航
- **wizard** - 交互式向导

### 可用的生产力技能（productivity）

- **teach** - 学习和教学工具
- **grill-me** - 知识测试
- **handoff** - 工作交接
- **writing-for-agents** - 为 AI 编写文档

## 使用方法

在 Claude Code 中使用 `/技能名称` 来调用技能，例如：
- `/setup-matt-pocock-skills` - 设置 TypeScript 开发环境
- `/code-review` - 进行代码审查
- `/triage` - 对问题进行分类

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the default five-label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout with root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.

# Session Dashboard

本地 Web 仪表板，用于浏览和监控 AI 编程工具（Claude Code、Codex CLI、Cursor、Aider）的历史会话记录。支持实时更新、全文搜索、Token 用量统计、多 session 对比等功能。

---

## 功能概览

- **多工具支持**：Claude Code、Codex CLI、Cursor、Aider 四个适配器，架构支持扩展
- **三栏布局**：项目列表 / Session 列表 / 聊天记录，支持拖拽调整宽度
- **实时更新**：SSE 监听文件变化，新 session 和消息变化自动刷新
- **全文搜索**：按消息内容搜索，限定当前项目，snippet 高亮展示
- **Token 统计**：解析原始 token 用量（含缓存 token），支持 session 和项目两个维度
- **多 session 对比**：并排查看两个 session 的完整对话
- **本地索引**：`~/.session-dashboard/index.json` 增量缓存，大幅提升加载速度
- **Shiki 代码高亮**：github-dark 主题，异步加载
- **工具调用展示**：Claude Code tool_use / tool_result 折叠块，Codex function_call 渲染

---

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Next.js 16 (App Router) + TypeScript |
| 样式 | Tailwind CSS v4 + shadcn/ui |
| 数据获取 | SWR + SSE (chokidar) |
| 代码高亮 | Shiki |
| 虚拟滚动 | @tanstack/react-virtual |
| 图表 | Recharts |
| SQLite（读 Cursor） | better-sqlite3 |

---

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)

---

## 目录结构

```
session-dashboard/
├── app/
│   ├── page.tsx                    # 仪表板（统计图表）
│   ├── sessions/page.tsx           # 三栏 session 浏览器
│   └── api/
│       ├── sessions/               # Session 列表 + 详情
│       ├── projects/               # 项目列表
│       ├── search/                 # 全文搜索
│       ├── token-usage/            # Token 用量统计
│       ├── stats/                  # 汇总统计
│       ├── watch/                  # SSE 实时推送
│       └── index/rebuild/          # 强制重建索引
├── lib/
│   ├── types.ts                    # 共享类型定义
│   ├── registry.ts                 # 适配器注册中心
│   ├── index-store.ts              # 本地 JSON 索引层
│   └── adapters/
│       ├── claude-code.ts          # Claude Code 适配器
│       ├── codex.ts                # Codex CLI 适配器
│       ├── cursor.ts               # Cursor 适配器（读 SQLite）
│       └── aider.ts                # Aider 适配器（读 .md）
├── components/
│   ├── session-detail/             # 聊天记录组件
│   ├── session-list/               # Session 列表组件
│   └── dashboard/                  # 统计图表组件
├── hooks/
│   ├── useSessions.ts
│   ├── useSession.ts
│   └── useRealtimeWatch.ts
└── docs/
    └── roadmap.md                  # 详细功能规划
```

---

## 数据源

| 工具 | 位置 | 格式 |
|------|------|------|
| Claude Code | `~/.claude/projects/{encoded-path}/*.jsonl` | JSONL，每行一个事件 |
| Codex CLI | `~/.codex/sessions/YYYY/MM/DD/{slug}-{uuid}.jsonl` | JSONL，含 session_meta |
| Cursor | `~/Library/Application Support/Cursor/User/workspaceStorage/*/state.vscdb` | SQLite，ItemTable |
| Aider | `{project-dir}/.aider.chat.history.md` | Markdown，`#### human/ai` 分段 |

---

## 本地索引

首次加载会扫描所有 JSONL 文件并写入 `~/.session-dashboard/index.json`（增量，只重解析 mtime 变化的文件）。

如遇 session 缺失，点击仪表板右上角的 **↺ 重建索引** 按钮强制全量重建。

---

## 键盘快捷键

| 按键 | 功能 |
|------|------|
| `/` | 聚焦搜索框 |
| `↑` / `↓` | 在 session 列表中移动 |
| `Enter` | 打开选中 session / 触发全文搜索 |
| `Esc` | 关闭当前 session / 清空搜索 |

---

## 已实现功能

| # | 功能 |
|---|------|
| 1 | 三栏布局，拖拽 resize，宽度持久化 |
| 2 | 左栏可折叠（48px 图标模式） |
| 3 | 项目列表：工具筛选（全部/CC/Codex）、hover 预览、复制路径 |
| 4 | Session 列表：虚拟滚动、日期筛选、收藏星标、进行中脉冲指示 |
| 5 | 全文搜索：按 Enter 触发，限定当前项目，snippet 高亮 |
| 6 | 聊天记录：按天时间轴分组、Shiki 代码高亮、复制按钮、消息书签 |
| 7 | 工具调用折叠展示（Claude Code / Codex） |
| 8 | 文件变更摘要：解析 tool_use 事件，显示涉及的文件 |
| 9 | Token 用量统计：session + 项目维度，含缓存 token |
| 10 | 多 session 并排对比视图 |
| 11 | 实时更新：SSE + chokidar，当前 session 精确刷新 |
| 12 | 统计图表：每日活跃度折线图 + Top5 项目 |
| 13 | 导出 session 为 Markdown |
| 14 | 亮暗主题切换 |
| 15 | 本地 JSON 索引层（mtime 增量更新） |

---

## Roadmap

完整规划见 [`docs/roadmap.md`](./docs/roadmap.md)。

### 待实现

| 功能 | 说明 |
|------|------|
| AI 生成 session 摘要 | 需要 `ANTHROPIC_API_KEY`，调用 Claude API 生成 2-3 句摘要，结果缓存本地 |
| AI 生成 session 摘要 | 需要 `ANTHROPIC_API_KEY`，调用 Claude API 生成 2-3 句摘要，结果缓存本地 |

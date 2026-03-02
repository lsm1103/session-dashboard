# Session Dashboard — Roadmap

> 最后更新：2026-03-02

---

## ✅ 已完成功能

| # | 功能 | 说明 |
|---|------|------|
| 1 | 三栏布局（拖拽 resize） | CSS + 鼠标事件，左/中固定宽度，右 flex-1，宽度持久化 localStorage |
| 2 | 左栏可折叠 | 折叠至 48px，CSS transition |
| 3 | 键盘导航 | ↑↓/Enter/Esc// |
| 4 | Shiki 代码高亮 | github-dark 主题，异步加载 |
| 5 | 分页加载 | 50 条/页，累积追加 |
| 6 | SSE 实时刷新 | 列表 + 当前 session 精确刷新 |
| 7 | 全文搜索 | /api/search，限定当前项目，snippet 高亮 |
| 8 | 导出 Markdown | Blob + a download |
| 9 | 复制消息 | hover 出现复制按钮，绿勾反馈 |
| 10 | 日期时间轴分组 | 消息按天分组 |
| 11 | Session 时长/消息统计 | 头部显示 Xh Ym + 用户↑ 助手↓ |
| 12 | JSONL 解析缓存 | mtime 比对 |
| 13 | Codex tool_call 展示 | reasoning / function_call / output |
| 14 | Claude Code tool_use 折叠展示 | ToolUseBlock / ToolResultBlock |
| 15 | 虚拟滚动 | @tanstack/react-virtual |
| 16 | 亮暗主题切换 | ThemeToggle + localStorage + 防 flash |
| 17 | 工具筛选 | 全部 / CC / Codex |
| 18 | 选中状态发光 | emerald 内发光 + 渐变 |
| 19 | 项目卡片 hover 预览 | tooltip 显示完整路径 |
| 20 | 消息气泡工具来源图标 | 助手消息左上角橙/蓝圆点 |

---

## 🚧 待实现

### 第一批：高价值（影响日常使用）

| # | 功能 | 状态 | 说明 |
|---|------|------|------|
| H1 | **日期筛选 + 快捷时间范围** | ✅ | 今天/近7天/近30天/全部；中间栏顶部按钮，前端过滤 |
| H2 | **正在进行中 session 高亮** | ✅ | SSE updated 事件提取 uuid，30s 超时清理；卡片绿色脉冲点 |
| H3 | **session 文件变更摘要** | ✅ | 解析 tool_use 提取文件路径，详情头部显示 badge |
| H4 | **快速收藏/书签** | ✅ | localStorage sd-starred；卡片 hover 星标；左栏 ⭐ 收藏入口 |

### 其他已完成

| # | 功能 | 说明 |
|---|------|------|
| X1 | **Token 用量统计** | /api/token-usage；session + 项目维度；ℹ 按钮打开 Modal |
| X2 | **多 session 对比视图** | 卡片 hover 对比按钮；选 2 个后右栏分左右两列并排 |

### 第二批：中等价值（提升体验）

| # | 功能 | 状态 | 说明 |
|---|------|------|------|
| M1 | **统计图表** | ✅ | Dashboard 页 recharts 折线图（CC/Codex 每日趋势）+ Top5 项目进度条 |
| M2 | **Cursor 适配器** | ✅ | better-sqlite3 读 state.vscdb，ItemTable 中提取 chatdata，前缀 csr- |
| M3 | **Aider 适配器** | ✅ | 扫描常见开发目录 .aider.chat.history.md，解析 #### human/ai，前缀 adr- |
| M4 | **消息级别书签** | ✅ | localStorage sd-msg-bookmarks；气泡 hover 书签按钮；SessionDetail 跳转入口 |
| M5 | **AI 生成 session 摘要** | ⏳ | 需要 ANTHROPIC_API_KEY；/api/summarize/[id]；结果缓存本地 JSON |

---

## 技术债

| 状态 | 问题 | 位置 |
|------|------|------|
| ✅ | JSONL 解析缓存 | `lib/adapters/claude-code.ts` |
| ✅ | Chokidar graceful shutdown | `app/api/watch/route.ts` |
| ✅ | React.memo for MessageBubble | `MessageBubble.tsx` |
| ✅ | 拖拽宽度持久化 | `app/sessions/page.tsx` |
| ✅ | JSON 本地索引层 | ~/.session-dashboard/index.json；mtime 增量更新；POST /api/index/rebuild 强制重建 |
| ⏳ | Session ID 去重合并策略 | `lib/registry.ts` |

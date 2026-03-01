# Session Dashboard — Roadmap

> 基于当前实现状态（2026-03-01）整理，按优先级分三波执行。
> 最后更新：2026-03-01

---

## 当前状态

### ✅ 已完成

| # | 功能 | 说明 |
|---|------|------|
| 1 | 三栏布局（拖拽 resize） | CSS + 鼠标事件，左 280px / 中 340px / 右 flex-1，可拖拽调整 |
| 2 | 左栏可折叠 | 折叠至 48px，CSS transition 动画 |
| 3 | 键盘导航 | ↑↓ 切换 session，Enter 打开，Esc 关闭/清空，/ 聚焦搜索 |
| 4 | Shiki 代码高亮 | github-dark 主题，异步加载，失败回退纯文本 |
| 5 | 分页加载 | useSessions 累积 50 条/页，hasMore + loadMore |
| 6 | SSE 实时刷新 | new-session / updated 事件刷新列表 + 当前 session |
| 7 | 全文搜索 API | /api/search，readline 流式 grep，10s 超时保护 |
| 8 | 导出 Markdown | 右栏下载按钮，Blob + a download |
| 9 | 复制消息 | 气泡 hover 出现复制按钮，1.5s 绿勾反馈 |
| 10 | 日期时间轴分组 | 消息按天分组，中间加日期分隔线 |
| 11 | Session 时长统计 | header 显示 Xh Ym + 用户↑ 助手↓ 消息数 |
| 12 | JSONL 解析缓存 | mtime 比对，未变化文件直接返回缓存 |
| 13 | Codex tool_call 展示 | reasoning / function_call / function_call_output 渲染 |
| 14 | Chokidar 优雅关闭 | SIGTERM/SIGINT 时 watcher.close() |
| 15 | React.memo 优化 | MessageBubble 用 memo 包裹避免无效重渲染 |
| 16 | 亮暗主题切换 | ThemeToggle 组件 + localStorage + 防 flash inline script |
| 17 | 项目卡片 hover 预览 | tooltip 显示完整路径 + session 数，边界检测防溢出 |
| 18 | 中间栏项目信息头 | 显示当前项目名 + session 数量 |
| 19 | 工具筛选按钮 | 全部 / CC / Codex 筛选左栏项目列表 |
| 20 | 空状态插画 | 无消息 / 未选中 session 显示 SVG 插画 |
| 21 | 滚动条美化 | track 透明，thumb 白色 12% 透明度，6px 宽 |
| 22 | 选中状态发光效果 | emerald 绿色内发光 + 渐变背景 |

### ✅ 全部完成（2026-03-01）

| # | 功能 |
|---|------|
| A | 虚拟滚动（session 列表，@tanstack/react-virtual） |
| B | 工具调用折叠展示（ToolUseBlock / ToolResultBlock，\x00 前缀协议） |
| C | 全文搜索 UI（🔍 切换模式，/api/search，snippet 高亮） |
| D | 消息气泡工具来源图标（toolId 从 SessionDetail 传入） |
| E | 拖拽宽度持久化（localStorage sd-left-w / sd-middle-w） |

---

## 第一波：影响日常使用的核心体验

### ~~1. 虚拟滚动~~ → **待完成 A**

**问题**：session 列表 / 消息列表全量挂载 DOM，数据量大时卡顿。
**方案**：`@tanstack/react-virtual` 的 `useVirtualizer`，只渲染可视区域节点。
**文件**：`app/sessions/page.tsx`（session 列表）、`components/session-detail/SessionDetail.tsx`（消息列表）

---

### ✅ 2. SSE 驱动当前 Session 实时刷新 — 已完成

### ✅ 3. 键盘导航 — 已完成

### ✅ 4. 代码块语法高亮 — 已完成

### ✅ 5. 分页 / 无限滚动 — 已完成

---

## 第二波：功能完整性

### ✅ 6. 全文检索 API — 已完成（UI 待接入）

### ~~7. 工具调用折叠展示~~ → **待完成 B**

**方案**：
- `lib/adapters/claude-code.ts`：解析 `tool_use` / `tool_result` 事件，生成特殊消息（role 仍为 assistant，content 用特殊前缀标记）
- 新建 `components/session-detail/ToolCallBlock.tsx`：折叠 `<details>` 样式，显示工具名 + 参数摘要
- `components/session-detail/MessageBubble.tsx`：识别特殊前缀，走 ToolCallBlock 渲染

### ✅ 8. 三栏可拖拽 Resize — 已完成

### ✅ 9. 导出 Session 为 Markdown — 已完成

### ✅ 10. Codex 消息格式健壮性 — 已完成

### ✅ 11. 复制单条消息 — 已完成

---

## 第三波：精致化

### ✅ 12. 消息时间轴分组 — 已完成

### ✅ 13. 左栏可折叠 — 已完成

### ✅ 14. 中间栏项目信息头部 — 已完成

### ✅ 15. 项目卡片 Hover 预览 — 已完成

### ✅ 16. 右栏 Session 头部补充信息 — 已完成

### ~~17. 消息气泡工具图标~~ → **待完成 D**

### ✅ 18. 亮色主题支持 — 已完成

### ✅ 19. 空状态插画 — 已完成

---

## 技术债

| 状态 | 问题 | 位置 |
|------|------|------|
| ✅ | JSONL 解析缓存 | `lib/adapters/claude-code.ts` |
| ✅ | Chokidar graceful shutdown | `app/api/watch/route.ts` |
| ✅ | React.memo for MessageBubble | `MessageBubble.tsx` |
| ✅ | 拖拽宽度持久化 localStorage | `app/sessions/page.tsx` |
| ⏳ | Session ID 去重合并策略 | `lib/registry.ts` |

# Session Dashboard — Roadmap

> 基于当前实现状态（2026-03-01）整理，按优先级分三波执行。
> 最后更新：2026-03-01（第二波大部分已完成）

---

## 当前状态

- **已完成**：三栏可拖拽布局、左栏可折叠、键盘导航、Claude Code + Codex CLI 双适配器、SSE 实时监听 + 当前 Session 刷新、全文搜索 API、分页加载、Shiki 代码高亮、消息复制按钮、工具来源图标、导出 Markdown、日期时间轴分组、时长统计、JSONL 解析缓存、Codex tool_call 展示、Chokidar 优雅关闭、亮暗主题切换、项目卡片 hover 预览、中间栏项目信息头
- **待完成**：虚拟滚动（列表 + 消息）、全文搜索 UI、工具调用折叠组件、空状态插画、消息气泡工具图标（需传 toolId）

---

## 第一波：影响日常使用的核心体验

### 1. 虚拟滚动（react-virtual）

**问题**：177 条 Session 全量挂载 DOM，Codex 数据更多时明显卡顿。
**方案**：中间栏 Session 列表和右栏聊天消息都改用 `@tanstack/react-virtual`，只渲染可视区域内的节点。
**文件**：`components/session-list/SessionList.tsx`、`components/session-detail/SessionDetail.tsx`

---

### 2. SSE 驱动当前 Session 实时刷新

**问题**：正在查看某个 Session 时，Claude 仍在写入，右栏不会追加新消息。
**方案**：`useRealtimeWatch` 收到 `updated` 事件时，提取事件里的文件路径 → 反推 sessionId → 若命中当前打开的 Session，触发 `useSession` 的 `mutate()`。
**文件**：`hooks/useRealtimeWatch.ts`、`hooks/useSession.ts`

---

### 3. 键盘导航

**方案**：
- `↑ / ↓`：在 Session 列表中移动焦点
- `Enter`：打开选中的 Session
- `Esc`：关闭右栏 / 清空搜索框
- `/`：聚焦搜索输入框

**文件**：`app/sessions/page.tsx`（在 `SessionsBrowser` 中监听 `keydown`）

---

### 4. 代码块语法高亮

**问题**：`react-markdown` 渲染代码块无颜色，可读性差。
**方案**：安装 `shiki`，在 `MessageBubble` 的 `code` 组件里按语言着色；用 `rehype-highlight` 或直接 `shiki` 的 `codeToHtml`。
**文件**：`components/session-detail/MessageBubble.tsx`

---

### 5. 分页 / 无限滚动

**问题**：Session 列表一次拉取 200 条，随数据增长会越来越慢。
**方案**：中间栏滚动到底部时自动追加下一页（`offset` + `limit`），配合虚拟滚动一起实现。
**文件**：`app/api/sessions/route.ts`（已支持 `offset`）、`hooks/useSessions.ts`

---

## 第二波：功能完整性

### 6. 全文检索消息内容

**问题**：只能按 Session 标题和项目路径搜索，无法检索聊天内容。
**方案**：API 侧用 `readline` 流式扫描 JSONL，对消息文本做 grep，返回匹配的 Session 列表（含高亮片段）。避免全量加载，做成独立的 `/api/search` 端点。
**文件**：新增 `app/api/search/route.ts`

---

### 7. 工具调用折叠展示

**问题**：`tool_use` / `tool_result` 事件目前全部跳过，丢失"Claude 读了哪些文件、执行了什么命令"的上下文。
**方案**：将工具调用解析为折叠块（`<details>`），显示工具名 + 输入参数摘要；`tool_result` 显示输出摘要或截断内容。用不同的视觉样式和普通消息区分（如左侧灰色边框 + 等宽字体）。
**文件**：`lib/adapters/claude-code.ts`、`lib/types.ts`（新增 `ToolCall` 类型）、`components/session-detail/ToolCallBlock.tsx`（新建）

---

### 8. 三栏可拖拽 Resize

**问题**：左栏 260px、中栏 300px 硬编码，窄屏或想看更多聊天记录时受限。
**方案**：使用 `react-resizable-panels` 替换固定宽度的三栏，拖动分隔线调整比例，宽度持久化到 `localStorage`。
**文件**：`app/sessions/page.tsx`

---

### 9. 导出 Session 为 Markdown

**方案**：右栏顶部加导出按钮，将当前 Session 的消息格式化为 Markdown（含角色标题、时间戳、代码块），通过 `Blob` + `<a download>` 触发下载。
**文件**：`components/session-detail/SessionDetail.tsx`

---

### 10. Codex 消息格式健壮性

**问题**：Codex 的 `response_item` 除 `message` 外还有 `reasoning`、`function_call` 等类型，目前全部跳过，可能丢失上下文。
**方案**：扩展 Codex 适配器，识别 `reasoning` 类型并合并到相邻消息；`function_call` 类似 Claude Code 工具调用，折叠展示。
**文件**：`lib/adapters/codex.ts`

---

### 11. 复制单条消息

**方案**：消息气泡 hover 时右上角显示复制图标，点击复制纯文本内容到剪贴板（去掉 Markdown 标记）。
**文件**：`components/session-detail/MessageBubble.tsx`

---

## 第三波：精致化

### 12. 消息时间轴分组

**方案**：同一天的消息连续展示，天与天之间插入日期分隔线（如 `2026年2月28日`）。格式参考 iMessage / Telegram 样式。
**文件**：`components/session-detail/SessionDetail.tsx`

---

### 13. 左栏可折叠

**方案**：左栏顶部加收起按钮，折叠后宽度收缩到 48px，只显示工具色圆点 + session 数量徽章；展开状态持久化到 `localStorage`。
**文件**：`app/sessions/page.tsx`

---

### 14. 中间栏项目信息头部

**问题**：选中项目后，中间栏顶部只有搜索框，缺少"当前在看哪个项目"的上下文。
**方案**：搜索框上方加一行项目名 + 路径 + session 总数，选中"所有项目"时显示汇总数据。

---

### 15. 项目卡片 Hover 预览

**方案**：鼠标悬停项目卡片时，Tooltip 展示该项目最近一条 Session 的标题和时间，不用点进去就能感知内容。
**文件**：`app/sessions/page.tsx`（`ProjectCard` 组件）

---

### 16. 右栏 Session 头部补充信息

**方案**：在 Session 标题行加两个数据：
- **时长**：`lastActivity - startTime`，格式化为"2h 34m"
- **消息数**：当前已显示，但可以分"用户 / 助手"分开计数

---

### 17. 消息气泡工具图标

**方案**：助手消息左上角加 CC / CDX 工具小图标（16×16 SVG），颜色对应橙色/蓝色，增强对话归属感。
**文件**：`components/session-detail/MessageBubble.tsx`

---

### 18. 亮色主题支持

**问题**：现在写死 `dark` class，CSS 变量已经定义了亮色值但从未启用。
**方案**：在根 layout 加 theme toggle 按钮，切换 `html` 元素上的 `dark` class，选择持久化到 `localStorage`。
**文件**：`app/layout.tsx`、新增 `components/ThemeToggle.tsx`

---

### 19. 空状态插画

**方案**：无 Session / 搜索无结果 / 未选中 Session 时，用简单的内联 SVG 插画替代纯文字提示。
**文件**：`app/sessions/page.tsx`、`components/session-detail/SessionDetail.tsx`

---

## 技术债

| 问题 | 位置 | 说明 |
|------|------|------|
| `getSessions` 全量解析所有 JSONL | `lib/adapters/claude-code.ts` | 目前每次请求都 readline 扫描所有文件，应加内存缓存（`Map<filePath, {mtime, session}>`），文件未变化时直接返回缓存 |
| Session ID 去重依赖 lastActivity | `lib/registry.ts` | 如果同 UUID 两个文件的 lastActivity 相同会随机保留一个，需要改为合并策略 |
| chokidar watcher 无 graceful shutdown | `app/api/watch/route.ts` | 进程退出时 watcher 没有 `.close()`，长期运行可能有文件描述符泄漏 |
| `react-markdown` 无记忆化 | `MessageBubble.tsx` | 大 Session（200+ 消息）滚动时每次重渲染都重新解析 Markdown，加 `React.memo` |

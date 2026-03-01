import fs from 'fs';
import path from 'path';
import readline from 'readline';
import os from 'os';
import type { ISessionAdapter, Project, Session, SessionDetail, Message } from '../types';

const BASE_PATH = path.join(os.homedir(), '.claude', 'projects');

function encodeProjectId(dirName: string): string {
  return encodeURIComponent(dirName);
}

function extractTextFromContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((c: unknown) => typeof c === 'object' && c !== null && (c as Record<string, unknown>).type === 'text')
      .map((c: unknown) => (c as Record<string, unknown>).text as string)
      .join('');
  }
  return '';
}

function isValidUserMessage(line: Record<string, unknown>): boolean {
  if (line.type !== 'user') return false;
  const msg = line.message as Record<string, unknown> | undefined;
  if (!msg || msg.role !== 'user') return false;
  const content = msg.content;
  if (!content) return false;
  // Skip isMeta messages
  if (Array.isArray(content)) {
    const hasIsMeta = content.some(
      (c: unknown) => typeof c === 'object' && c !== null && (c as Record<string, unknown>).isMeta === true
    );
    if (hasIsMeta) return false;
  }
  return true;
}

function isValidAssistantMessage(line: Record<string, unknown>): boolean {
  if (line.type !== 'assistant') return false;
  const msg = line.message as Record<string, unknown> | undefined;
  if (!msg || msg.role !== 'assistant') return false;
  return true;
}

async function readLines(filePath: string): Promise<string[]> {
  const lines: string[] = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (line.trim()) lines.push(line);
  }
  return lines;
}

// Module-level cache: key = filePath, value = { mtime: number, result: ParsedSession }
type ParsedSession = NonNullable<Awaited<ReturnType<typeof parseSessionFile>>>;
const parseCache = new Map<string, { mtime: number; result: ParsedSession }>();

async function parseSessionFile(filePath: string): Promise<{
  sessionId: string;
  cwd: string;
  startTime: Date;
  lastActivity: Date;
  messages: Message[];
  title: string;
} | null> {
  // Check cache by file mtime
  try {
    const mtime = fs.statSync(filePath).mtimeMs;
    const cached = parseCache.get(filePath);
    if (cached && cached.mtime === mtime) {
      return cached.result;
    }
  } catch {
    // File may not exist; continue to let readLines handle the error
  }

  let lines: string[];
  try {
    lines = await readLines(filePath);
  } catch {
    return null;
  }

  let sessionId = '';
  let cwd = '';
  let startTime: Date | null = null;
  let lastActivity: Date | null = null;
  const messages: Message[] = [];
  let title = '';

  const SKIP_TYPES = new Set([
    'progress', 'file-history-snapshot', 'system',
    'thinking', 'image', 'hook_progress', 'agent_progress', 'direct'
  ]);

  for (const rawLine of lines) {
    let line: Record<string, unknown>;
    try {
      line = JSON.parse(rawLine);
    } catch {
      continue;
    }

    // Extract session metadata from first event
    if (!sessionId && line.sessionId) sessionId = String(line.sessionId);
    if (!cwd && line.cwd) cwd = String(line.cwd);
    if (line.timestamp) {
      const ts = new Date(String(line.timestamp));
      if (!startTime) startTime = ts;
      lastActivity = ts;
    }

    if (SKIP_TYPES.has(String(line.type))) continue;

    // tool_use 事件：工具调用
    if (line.type === 'tool_use') {
      const toolName = String((line as Record<string, unknown>).name || 'unknown');
      const input = (line as Record<string, unknown>).input;
      let inputStr: string;
      try {
        inputStr = JSON.stringify(input, null, 2);
      } catch {
        inputStr = String(input || '{}');
      }
      // 截断超长输入
      if (inputStr.length > 800) inputStr = inputStr.slice(0, 800) + '\n...';

      const msgId = `${sessionId}-tu-${messages.length}`;
      messages.push({
        id: msgId,
        role: 'assistant' as const,
        content: `\x00TOOL_USE\x00${toolName}\x00${inputStr}`,
        timestamp: line.timestamp ? new Date(String(line.timestamp)) : new Date(),
      });
      continue;
    }

    // tool_result 事件：工具返回
    if (line.type === 'tool_result') {
      const content = (line as Record<string, unknown>).content;
      let resultStr: string;
      if (typeof content === 'string') {
        resultStr = content;
      } else if (Array.isArray(content)) {
        resultStr = content
          .filter((c: unknown) => typeof c === 'object' && c !== null && (c as Record<string, unknown>).type === 'text')
          .map((c: unknown) => String((c as Record<string, unknown>).text))
          .join('\n');
      } else {
        resultStr = JSON.stringify(content);
      }
      // 截断
      if (resultStr.length > 600) resultStr = resultStr.slice(0, 600) + '\n...';

      const msgId = `${sessionId}-tr-${messages.length}`;
      messages.push({
        id: msgId,
        role: 'assistant' as const,
        content: `\x00TOOL_RESULT\x00${resultStr}`,
        timestamp: line.timestamp ? new Date(String(line.timestamp)) : new Date(),
      });
      continue;
    }

    if (isValidUserMessage(line)) {
      const msg = line.message as Record<string, unknown>;
      const content = extractTextFromContent(msg.content);
      if (!content) continue;
      // Skip system-injected messages
      if (content.startsWith('<') || content.startsWith('#')) continue;

      const msgId = `${sessionId}-u-${messages.length}`;
      messages.push({
        id: msgId,
        role: 'user',
        content,
        timestamp: line.timestamp ? new Date(String(line.timestamp)) : new Date(),
      });

      if (!title && content) {
        title = content.slice(0, 80);
      }
    } else if (isValidAssistantMessage(line)) {
      const msg = line.message as Record<string, unknown>;
      const contentArr = msg.content as Array<Record<string, unknown>> | undefined;
      if (!contentArr) continue;
      const content = contentArr
        .filter(c => c.type === 'text')
        .map(c => String(c.text))
        .join('');
      if (!content) continue;

      const msgId = `${sessionId}-a-${messages.length}`;
      messages.push({
        id: msgId,
        role: 'assistant',
        content,
        timestamp: line.timestamp ? new Date(String(line.timestamp)) : new Date(),
      });
    }
  }

  if (!sessionId) {
    // Use filename as session ID fallback
    sessionId = path.basename(filePath, '.jsonl');
  }

  const result = {
    sessionId,
    cwd: cwd || path.dirname(filePath),
    startTime: startTime || new Date(fs.statSync(filePath).mtime),
    lastActivity: lastActivity || new Date(fs.statSync(filePath).mtime),
    messages,
    title: title || 'Untitled session',
  };

  // Store in cache
  try {
    const mtime = fs.statSync(filePath).mtimeMs;
    parseCache.set(filePath, { mtime, result });
  } catch {
    // Ignore cache store errors
  }

  return result;
}

export class ClaudeCodeAdapter implements ISessionAdapter {
  toolId = 'claude-code';

  getBasePath(): string {
    return BASE_PATH;
  }

  async getProjects(): Promise<Project[]> {
    if (!fs.existsSync(BASE_PATH)) return [];

    const dirs = fs.readdirSync(BASE_PATH, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    const projects: Project[] = [];

    for (const dir of dirs) {
      const dirPath = path.join(BASE_PATH, dir);
      const jsonlFiles = fs.readdirSync(dirPath).filter(f => f.endsWith('.jsonl'));
      if (jsonlFiles.length === 0) continue;

      // Get real cwd from first session file
      let realCwd = dir; // fallback
      let lastActivity = new Date(0);

      for (const file of jsonlFiles) {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);
        if (stat.mtime > lastActivity) lastActivity = stat.mtime;

        if (realCwd === dir) {
          try {
            const firstLine = fs.readFileSync(filePath, 'utf8').split('\n')[0];
            if (firstLine) {
              const parsed = JSON.parse(firstLine);
              if (parsed.cwd) realCwd = parsed.cwd;
            }
          } catch {
            // keep fallback
          }
        }
      }

      projects.push({
        id: encodeProjectId(dir),
        path: realCwd,
        toolId: 'claude-code',
        sessionCount: jsonlFiles.length,
        lastActivity,
      });
    }

    return projects.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  }

  async getSessions(projectPath?: string): Promise<Session[]> {
    if (!fs.existsSync(BASE_PATH)) return [];

    const dirs = fs.readdirSync(BASE_PATH, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    // Use a map to deduplicate: same sessionId may appear in multiple files
    const seen = new Map<string, Session>();

    for (const dir of dirs) {
      const dirPath = path.join(BASE_PATH, dir);
      const jsonlFiles = fs.readdirSync(dirPath).filter(f => f.endsWith('.jsonl'));

      for (const file of jsonlFiles) {
        const filePath = path.join(dirPath, file);
        const parsed = await parseSessionFile(filePath);
        if (!parsed) continue;

        if (projectPath && parsed.cwd !== projectPath) continue;

        const id = `cc-${parsed.sessionId}`;
        const candidate: Session = {
          id,
          toolId: 'claude-code',
          projectPath: parsed.cwd,
          title: parsed.title,
          messageCount: parsed.messages.length,
          startTime: parsed.startTime,
          lastActivity: parsed.lastActivity,
        };

        const existing = seen.get(id);
        if (!existing || parsed.lastActivity > existing.lastActivity) {
          seen.set(id, candidate);
        }
      }
    }

    return Array.from(seen.values())
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  }

  async getSession(id: string): Promise<SessionDetail> {
    // id format: cc-{uuid}
    const uuid = id.replace(/^cc-/, '');

    if (!fs.existsSync(BASE_PATH)) {
      throw new Error(`Session not found: ${id}`);
    }

    const dirs = fs.readdirSync(BASE_PATH, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    // 收集所有匹配该 uuid 的文件（同一 session 可能因 symlink/路径差异分散在多个目录）
    const matchedFiles: string[] = [];

    for (const dir of dirs) {
      const dirPath = path.join(BASE_PATH, dir);
      const jsonlFiles = fs.readdirSync(dirPath).filter(f => f.endsWith('.jsonl'));
      for (const file of jsonlFiles) {
        if (file === `${uuid}.jsonl` || file.includes(uuid)) {
          matchedFiles.push(path.join(dirPath, file));
        }
      }
    }

    // 如果按文件名没找到，按内部 sessionId 字段再扫一遍
    if (matchedFiles.length === 0) {
      for (const dir of dirs) {
        const dirPath = path.join(BASE_PATH, dir);
        const jsonlFiles = fs.readdirSync(dirPath).filter(f => f.endsWith('.jsonl'));
        for (const file of jsonlFiles) {
          const filePath = path.join(dirPath, file);
          try {
            const firstLine = fs.readFileSync(filePath, 'utf8').split('\n')[0];
            const parsed = firstLine ? JSON.parse(firstLine) : null;
            if (parsed?.sessionId === uuid) matchedFiles.push(filePath);
          } catch { /* skip */ }
        }
      }
    }

    if (matchedFiles.length === 0) {
      throw new Error(`Session not found: ${id}`);
    }

    // 解析所有匹配文件并合并消息
    const allParsed = (await Promise.all(matchedFiles.map(f => parseSessionFile(f))))
      .filter(Boolean) as NonNullable<Awaited<ReturnType<typeof parseSessionFile>>>[];

    if (allParsed.length === 0) {
      throw new Error(`Session not found: ${id}`);
    }

    // 取最新的元数据（cwd、title 等），合并所有消息后按时间戳排序去重
    allParsed.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
    const best = allParsed[0];

    const allMessages = allParsed.flatMap(p => p.messages);
    // 按时间戳排序，内容相同的相邻消息去重
    allMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const dedupedMessages = allMessages.filter((msg, i) => {
      if (i === 0) return true;
      const prev = allMessages[i - 1];
      return !(msg.role === prev.role && msg.content === prev.content);
    });

    return {
      id,
      toolId: 'claude-code',
      projectPath: best.cwd,
      title: best.title,
      messageCount: dedupedMessages.length,
      startTime: allParsed[allParsed.length - 1].startTime,
      lastActivity: best.lastActivity,
      messages: dedupedMessages,
    };
  }
}

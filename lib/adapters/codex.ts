import fs from 'fs';
import path from 'path';
import readline from 'readline';
import os from 'os';
import { findIndexedFilePathBySessionId } from '../index-lookup';
import { LruCache } from '../lru-cache';
import type { ISessionAdapter, Project, Session, SessionDetail, Message } from '../types';

const BASE_PATH = path.join(os.homedir(), '.codex', 'sessions');

function encodeProjectId(cwd: string): string {
  return encodeURIComponent(cwd);
}

function shouldSkipUserMessage(content: string): boolean {
  return content.startsWith('#') ||
    content.startsWith('<environment_context>') ||
    content.startsWith('<task>');
}

interface CodexSessionMeta {
  id: string;
  cwd: string;
  timestamp: string;
  model_provider?: string;
  git?: unknown;
}

type ParsedCodexSession = NonNullable<Awaited<ReturnType<typeof parseCodexFile>>>;
const PARSE_CACHE_LIMIT = 200;
const parseCache = new LruCache<string, { mtime: number; result: ParsedCodexSession }>(PARSE_CACHE_LIMIT);

async function parseCodexFile(filePath: string): Promise<{
  sessionId: string;
  cwd: string;
  startTime: Date;
  lastActivity: Date;
  messages: Message[];
  title: string;
} | null> {
  let mtime = 0;
  try {
    const stat = fs.statSync(filePath);
    mtime = stat.mtimeMs;
    const cached = parseCache.get(filePath);
    if (cached && cached.mtime === mtime) {
      return cached.result;
    }
  } catch {
    return null;
  }

  let meta: CodexSessionMeta | null = null;
  const messages: Message[] = [];
  let title = '';
  let lastActivity: Date | null = null;
  let pendingReasoning: string | null = null;

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });

  try {
    for await (const rawLine of rl) {
      if (!rawLine.trim()) continue;

      let line: Record<string, unknown>;
      try {
        line = JSON.parse(rawLine);
      } catch {
        continue;
      }

      if (line.type === 'session_meta') {
        const payload = line.payload as CodexSessionMeta;
        meta = payload;
        continue;
      }

      if (line.type === 'response_item') {
        const payload = line.payload as Record<string, unknown>;

        if (payload.type === 'reasoning') {
          let reasoningText = '';
          const contentArr = payload.content as Array<Record<string, unknown>> | undefined;
          const summaryArr = payload.summary as Array<Record<string, unknown>> | undefined;
          if (contentArr) {
            reasoningText = contentArr
              .filter(c => c.type === 'input_text')
              .map(c => String(c.text))
              .join('');
          }
          if (!reasoningText && summaryArr) {
            reasoningText = summaryArr
              .map(c => String(c.text || ''))
              .join('');
          }
          if (reasoningText) {
            pendingReasoning = reasoningText;
          }
          continue;
        }

        if (payload.type === 'function_call') {
          const name = String(payload.name || 'unknown');
          let argsStr: string;
          try {
            const args = typeof payload.arguments === 'string'
              ? JSON.parse(payload.arguments)
              : payload.arguments;
            argsStr = JSON.stringify(args, null, 2);
          } catch {
            argsStr = String(payload.arguments || '{}');
          }
          const content = `🔧 **${name}**\n\`\`\`json\n${argsStr}\n\`\`\``;
          const msgId = `${meta?.id || 'cdx'}-fc-${messages.length}`;
          const ts = line.timestamp ? new Date(String(line.timestamp)) : new Date();
          lastActivity = ts;
          messages.push({ id: msgId, role: 'assistant', content, timestamp: ts });
          continue;
        }

        if (payload.type === 'function_call_output') {
          const output = String(payload.output || '');
          const truncated = output.length > 500 ? output.slice(0, 500) + '...' : output;
          const content = `📤 **工具返回**\n\`\`\`\n${truncated}\n\`\`\``;
          const msgId = `${meta?.id || 'cdx'}-fo-${messages.length}`;
          const ts = line.timestamp ? new Date(String(line.timestamp)) : new Date();
          lastActivity = ts;
          messages.push({ id: msgId, role: 'assistant', content, timestamp: ts });
          continue;
        }

        if (payload.type !== 'message') continue;

        const role = payload.role as string;
        const contentArr = payload.content as Array<Record<string, unknown>> | undefined;
        if (!contentArr) continue;

        if (role === 'user') {
          const textContent = contentArr
            .filter(c => c.type === 'input_text')
            .map(c => String(c.text))
            .join('');
          if (!textContent || shouldSkipUserMessage(textContent)) continue;

          const msgId = `${meta?.id || 'cdx'}-u-${messages.length}`;
          const ts = line.timestamp ? new Date(String(line.timestamp)) : new Date();
          lastActivity = ts;
          messages.push({
            id: msgId,
            role: 'user',
            content: textContent,
            timestamp: ts,
          });

          if (!title) title = textContent.slice(0, 80);
        } else if (role === 'assistant') {
          const textContent = contentArr
            .filter(c => c.type === 'output_text')
            .map(c => String(c.text))
            .join('');
          if (!textContent) continue;

          let finalContent = textContent;
          if (pendingReasoning) {
            finalContent = `> 💭 ${pendingReasoning}\n\n${textContent}`;
            pendingReasoning = null;
          }

          const msgId = `${meta?.id || 'cdx'}-a-${messages.length}`;
          const ts = line.timestamp ? new Date(String(line.timestamp)) : new Date();
          lastActivity = ts;
          messages.push({
            id: msgId,
            role: 'assistant',
            content: finalContent,
            timestamp: ts,
          });
        }
      }
    }
  } catch {
    return null;
  } finally {
    rl.close();
  }

  // If there's leftover reasoning not followed by an assistant message, emit as standalone
  if (pendingReasoning) {
    const msgId = `${meta?.id || 'cdx'}-r-${messages.length}`;
    messages.push({
      id: msgId,
      role: 'assistant',
      content: `> 💭 ${pendingReasoning}`,
      timestamp: lastActivity || new Date(),
    });
    pendingReasoning = null;
  }

  if (!meta) return null;

  const startTime = new Date(meta.timestamp);

  const result = {
    sessionId: meta.id,
    cwd: meta.cwd,
    startTime,
    lastActivity: lastActivity || startTime,
    messages,
    title: title || 'Untitled session',
  };

  parseCache.set(filePath, { mtime, result });

  return result;
}

function getAllJsonlFiles(basePath: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(basePath)) return files;

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        files.push(fullPath);
      }
    }
  }

  walk(basePath);
  return files;
}

export class CodexAdapter implements ISessionAdapter {
  toolId = 'codex';

  getBasePath(): string {
    return BASE_PATH;
  }

  async getProjects(): Promise<Project[]> {
    const files = getAllJsonlFiles(BASE_PATH);
    const projectMap = new Map<string, { count: number; lastActivity: Date }>();

    for (const file of files) {
      const parsed = await parseCodexFile(file);
      if (!parsed) continue;

      const key = parsed.cwd;
      const existing = projectMap.get(key);
      if (!existing) {
        projectMap.set(key, { count: 1, lastActivity: parsed.lastActivity });
      } else {
        existing.count++;
        if (parsed.lastActivity > existing.lastActivity) {
          existing.lastActivity = parsed.lastActivity;
        }
      }
    }

    return Array.from(projectMap.entries())
      .map(([cwd, data]) => ({
        id: encodeProjectId(cwd),
        path: cwd,
        toolId: 'codex',
        sessionCount: data.count,
        lastActivity: data.lastActivity,
      }))
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  }

  async getSessions(projectPath?: string): Promise<Session[]> {
    const files = getAllJsonlFiles(BASE_PATH);
    const sessions: Session[] = [];

    for (const file of files) {
      const parsed = await parseCodexFile(file);
      if (!parsed) continue;
      if (projectPath && parsed.cwd !== projectPath) continue;

      sessions.push({
        id: `cdx-${parsed.sessionId}`,
        toolId: 'codex',
        projectPath: parsed.cwd,
        title: parsed.title,
        messageCount: parsed.messages.length,
        startTime: parsed.startTime,
        lastActivity: parsed.lastActivity,
      });
    }

    return sessions.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  }

  async getSession(id: string): Promise<SessionDetail> {
    const sessionId = id.replace(/^cdx-/, '');
    const indexedFilePath = findIndexedFilePathBySessionId(id);
    if (indexedFilePath && indexedFilePath.startsWith(BASE_PATH) && fs.existsSync(indexedFilePath)) {
      const parsed = await parseCodexFile(indexedFilePath);
      if (parsed && parsed.sessionId === sessionId) {
        return {
          id,
          toolId: 'codex',
          projectPath: parsed.cwd,
          title: parsed.title,
          messageCount: parsed.messages.length,
          startTime: parsed.startTime,
          lastActivity: parsed.lastActivity,
          messages: parsed.messages,
        };
      }
    }

    const files = getAllJsonlFiles(BASE_PATH);

    for (const file of files) {
      if (file.includes(sessionId)) {
        const parsed = await parseCodexFile(file);
        if (!parsed) continue;
        return {
          id,
          toolId: 'codex',
          projectPath: parsed.cwd,
          title: parsed.title,
          messageCount: parsed.messages.length,
          startTime: parsed.startTime,
          lastActivity: parsed.lastActivity,
          messages: parsed.messages,
        };
      }
    }

    // Second pass: match by sessionId field
    for (const file of files) {
      const parsed = await parseCodexFile(file);
      if (!parsed) continue;
      if (parsed.sessionId === sessionId) {
        return {
          id,
          toolId: 'codex',
          projectPath: parsed.cwd,
          title: parsed.title,
          messageCount: parsed.messages.length,
          startTime: parsed.startTime,
          lastActivity: parsed.lastActivity,
          messages: parsed.messages,
        };
      }
    }

    throw new Error(`Session not found: ${id}`);
  }
}

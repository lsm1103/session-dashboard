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

async function parseSessionFile(filePath: string): Promise<{
  sessionId: string;
  cwd: string;
  startTime: Date;
  lastActivity: Date;
  messages: Message[];
  title: string;
} | null> {
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
    'progress', 'file-history-snapshot', 'system', 'tool_use',
    'tool_result', 'thinking', 'image', 'hook_progress', 'agent_progress', 'direct'
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

  return {
    sessionId,
    cwd: cwd || path.dirname(filePath),
    startTime: startTime || new Date(fs.statSync(filePath).mtime),
    lastActivity: lastActivity || new Date(fs.statSync(filePath).mtime),
    messages,
    title: title || 'Untitled session',
  };
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

    for (const dir of dirs) {
      const dirPath = path.join(BASE_PATH, dir);
      const jsonlFiles = fs.readdirSync(dirPath).filter(f => f.endsWith('.jsonl'));

      for (const file of jsonlFiles) {
        // Match by filename (uuid.jsonl) or by sessionId inside
        if (file === `${uuid}.jsonl` || file.includes(uuid)) {
          const filePath = path.join(dirPath, file);
          const parsed = await parseSessionFile(filePath);
          if (!parsed) continue;

          return {
            id,
            toolId: 'claude-code',
            projectPath: parsed.cwd,
            title: parsed.title,
            messageCount: parsed.messages.length,
            startTime: parsed.startTime,
            lastActivity: parsed.lastActivity,
            messages: parsed.messages,
          };
        }
      }
    }

    // Second pass: search by sessionId inside files
    for (const dir of dirs) {
      const dirPath = path.join(BASE_PATH, dir);
      const jsonlFiles = fs.readdirSync(dirPath).filter(f => f.endsWith('.jsonl'));

      for (const file of jsonlFiles) {
        const filePath = path.join(dirPath, file);
        const parsed = await parseSessionFile(filePath);
        if (!parsed) continue;
        if (parsed.sessionId === uuid) {
          return {
            id,
            toolId: 'claude-code',
            projectPath: parsed.cwd,
            title: parsed.title,
            messageCount: parsed.messages.length,
            startTime: parsed.startTime,
            lastActivity: parsed.lastActivity,
            messages: parsed.messages,
          };
        }
      }
    }

    throw new Error(`Session not found: ${id}`);
  }
}

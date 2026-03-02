import fs from 'fs';
import path from 'path';
import os from 'os';
import type { ISessionAdapter, Project, Session, SessionDetail, Message } from '../types';

const HISTORY_FILE = '.aider.chat.history.md';

// 扫描常见目录（最多 4 层深）查找 .aider.chat.history.md
function findAiderFiles(baseDir: string, maxDepth = 4): string[] {
  const results: string[] = [];
  if (!fs.existsSync(baseDir)) return results;

  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== HISTORY_FILE) continue;
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile() && entry.name === HISTORY_FILE) {
        results.push(fullPath);
      } else if (entry.isDirectory() && depth < maxDepth) {
        walk(fullPath, depth + 1);
      }
    }
  }

  walk(baseDir, 0);
  return results;
}

function parseAiderFile(filePath: string): {
  id: string;
  cwd: string;
  title: string;
  messages: Message[];
  startTime: Date;
  lastActivity: Date;
} | null {
  let content: string;
  try { content = fs.readFileSync(filePath, 'utf8'); } catch { return null; }

  const cwd = path.dirname(filePath);
  const stat = fs.statSync(filePath);

  // 提取开始时间
  const startMatch = content.match(/# aider chat started at (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
  const startTime = startMatch ? new Date(startMatch[1]) : stat.birthtime;

  // 解析消息：按 #### human / #### ai 分割
  const messages: Message[] = [];
  const segments = content.split(/^#### (human|ai)\s*$/m);

  let title = '';
  for (let i = 1; i < segments.length - 1; i += 2) {
    const role = segments[i].trim() === 'human' ? 'user' : 'assistant';
    const msgContent = segments[i + 1]
      .replace(/^>\s+.*$/mg, '') // 去掉 > /path/to/file 行
      .trim();
    if (!msgContent) continue;

    if (!title && role === 'user') title = msgContent.slice(0, 80);

    messages.push({
      id: `aider-${filePath}-${i}`,
      role,
      content: msgContent,
      timestamp: startTime,
    });
  }

  if (!messages.length) return null;

  const sessionId = Buffer.from(filePath).toString('base64').replace(/[/+=]/g, '').slice(0, 16);

  return {
    id: sessionId,
    cwd,
    title: title || path.basename(cwd),
    messages,
    startTime,
    lastActivity: stat.mtime,
  };
}

export class AiderAdapter implements ISessionAdapter {
  toolId = 'aider';

  getBasePath(): string {
    return os.homedir();
  }

  private getAiderFiles(): string[] {
    const home = os.homedir();
    // 扫描常见开发目录
    const searchDirs = [
      path.join(home, 'Desktop'),
      path.join(home, 'Documents'),
      path.join(home, 'Projects'),
      path.join(home, 'project'),
      path.join(home, 'work'),
      path.join(home, 'dev'),
      path.join(home, 'code'),
      path.join(home, 'src'),
    ].filter(d => fs.existsSync(d));

    const files = new Set<string>();
    for (const dir of searchDirs) {
      for (const f of findAiderFiles(dir, 4)) files.add(f);
    }
    return [...files];
  }

  async getProjects(): Promise<Project[]> {
    const files = this.getAiderFiles();
    const projectMap = new Map<string, { count: number; lastActivity: Date }>();

    for (const f of files) {
      const parsed = parseAiderFile(f);
      if (!parsed) continue;
      const existing = projectMap.get(parsed.cwd);
      if (!existing) {
        projectMap.set(parsed.cwd, { count: 1, lastActivity: parsed.lastActivity });
      } else {
        existing.count++;
        if (parsed.lastActivity > existing.lastActivity) existing.lastActivity = parsed.lastActivity;
      }
    }

    return Array.from(projectMap.entries()).map(([cwd, data]) => ({
      id: encodeURIComponent(cwd),
      path: cwd,
      toolId: 'aider',
      sessionCount: data.count,
      lastActivity: data.lastActivity,
    })).sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  }

  async getSessions(projectPath?: string): Promise<Session[]> {
    const files = this.getAiderFiles();
    const sessions: Session[] = [];

    for (const f of files) {
      const parsed = parseAiderFile(f);
      if (!parsed) continue;
      if (projectPath && parsed.cwd !== projectPath) continue;

      sessions.push({
        id: `adr-${parsed.id}`,
        toolId: 'aider',
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
    const rawId = id.replace(/^adr-/, '');
    const files = this.getAiderFiles();

    for (const f of files) {
      const parsed = parseAiderFile(f);
      if (!parsed || parsed.id !== rawId) continue;
      return {
        id,
        toolId: 'aider',
        projectPath: parsed.cwd,
        title: parsed.title,
        messageCount: parsed.messages.length,
        startTime: parsed.startTime,
        lastActivity: parsed.lastActivity,
        messages: parsed.messages,
      };
    }

    throw new Error(`Session not found: ${id}`);
  }
}

import fs from 'fs';
import path from 'path';
import os from 'os';
import type { ISessionAdapter, Project, Session, SessionDetail, Message } from '../types';

// better-sqlite3 在 server 环境同步运行，用 require 避免 ESM 问题
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require('better-sqlite3');

function getCursorBase(): string {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Cursor', 'User', 'workspaceStorage');
  }
  return path.join(os.homedir(), '.config', 'Cursor', 'User', 'workspaceStorage');
}

function getAllDbFiles(base: string): string[] {
  if (!fs.existsSync(base)) return [];
  const files: string[] = [];
  for (const hash of fs.readdirSync(base)) {
    const dbPath = path.join(base, hash, 'state.vscdb');
    if (fs.existsSync(dbPath)) files.push(dbPath);
  }
  return files;
}

interface CursorBubble {
  type?: string;
  role?: string;
  text?: string;
  richText?: string;
  content?: string;
}

interface CursorTab {
  tabId?: string;
  chatTitle?: string;
  bubbles?: CursorBubble[];
  messages?: CursorBubble[];
}

function parseCursorDb(dbPath: string): {
  sessions: { id: string; cwd: string; title: string; messages: Message[]; startTime: Date; lastActivity: Date }[];
} {
  const result: ReturnType<typeof parseCursorDb> = { sessions: [] };
  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const rows = db.prepare("SELECT key, value FROM ItemTable WHERE key LIKE '%chatdata%' OR key LIKE '%chat%'").all() as { key: string; value: string }[];
    db.close();

    for (const row of rows) {
      try {
        const data = JSON.parse(row.value);
        const tabs: CursorTab[] = data.tabs || data.conversations || data.chats || (Array.isArray(data) ? data : []);

        for (const tab of tabs) {
          const bubbles: CursorBubble[] = tab.bubbles || tab.messages || [];
          if (!bubbles.length) continue;

          const messages: Message[] = [];
          let title = '';

          for (let i = 0; i < bubbles.length; i++) {
            const b = bubbles[i];
            const role = b.type === 'user' || b.role === 'user' ? 'user' : 'assistant';
            const content = b.text || b.richText || b.content || '';
            if (!content) continue;

            if (!title && role === 'user') title = content.slice(0, 80);

            messages.push({
              id: `cursor-${tab.tabId || i}-${role}-${i}`,
              role,
              content,
              timestamp: new Date(),
            });
          }

          if (!messages.length) continue;

          result.sessions.push({
            id: `cursor-${tab.tabId || row.key.replace(/[^a-z0-9]/gi, '-')}`,
            cwd: path.dirname(path.dirname(dbPath)), // workspaceStorage parent as fallback
            title: tab.chatTitle || title || 'Untitled',
            messages,
            startTime: new Date(),
            lastActivity: new Date(fs.statSync(dbPath).mtime),
          });
        }
      } catch { /* skip malformed row */ }
    }
  } catch { /* skip unreadable db */ }
  return result;
}

export class CursorAdapter implements ISessionAdapter {
  toolId = 'cursor';

  getBasePath(): string {
    return getCursorBase();
  }

  async getProjects(): Promise<Project[]> {
    const base = getCursorBase();
    const dbFiles = getAllDbFiles(base);
    const projectMap = new Map<string, { count: number; lastActivity: Date }>();

    for (const dbPath of dbFiles) {
      const { sessions } = parseCursorDb(dbPath);
      for (const s of sessions) {
        const existing = projectMap.get(s.cwd);
        if (!existing) {
          projectMap.set(s.cwd, { count: 1, lastActivity: s.lastActivity });
        } else {
          existing.count++;
          if (s.lastActivity > existing.lastActivity) existing.lastActivity = s.lastActivity;
        }
      }
    }

    return Array.from(projectMap.entries()).map(([cwd, data]) => ({
      id: encodeURIComponent(cwd),
      path: cwd,
      toolId: 'cursor',
      sessionCount: data.count,
      lastActivity: data.lastActivity,
    })).sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  }

  async getSessions(projectPath?: string): Promise<Session[]> {
    const base = getCursorBase();
    const dbFiles = getAllDbFiles(base);
    const sessions: Session[] = [];

    for (const dbPath of dbFiles) {
      const { sessions: dbSessions } = parseCursorDb(dbPath);
      for (const s of dbSessions) {
        if (projectPath && s.cwd !== projectPath) continue;
        sessions.push({
          id: `csr-${s.id}`,
          toolId: 'cursor',
          projectPath: s.cwd,
          title: s.title,
          messageCount: s.messages.length,
          startTime: s.startTime,
          lastActivity: s.lastActivity,
        });
      }
    }

    return sessions.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  }

  async getSession(id: string): Promise<SessionDetail> {
    const rawId = id.replace(/^csr-cursor-/, '').replace(/^csr-/, '');
    const base = getCursorBase();
    const dbFiles = getAllDbFiles(base);

    for (const dbPath of dbFiles) {
      const { sessions } = parseCursorDb(dbPath);
      for (const s of sessions) {
        if (s.id.includes(rawId) || id.includes(s.id)) {
          return {
            id,
            toolId: 'cursor',
            projectPath: s.cwd,
            title: s.title,
            messageCount: s.messages.length,
            startTime: s.startTime,
            lastActivity: s.lastActivity,
            messages: s.messages,
          };
        }
      }
    }

    throw new Error(`Session not found: ${id}`);
  }
}

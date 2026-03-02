import { ClaudeCodeAdapter } from './adapters/claude-code';
import { CodexAdapter } from './adapters/codex';
import { CursorAdapter } from './adapters/cursor';
import { AiderAdapter } from './adapters/aider';
import type { ISessionAdapter, Project, Session } from './types';

function getAdapters(): ISessionAdapter[] {
  return [
    new ClaudeCodeAdapter(),
    new CodexAdapter(),
    new CursorAdapter(),
    new AiderAdapter(),
  ];
}

async function getAllProjects(): Promise<Project[]> {
  const adapters = getAdapters();
  const results = await Promise.all(adapters.map(a => a.getProjects()));
  return results
    .flat()
    .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
}

async function getAllSessions(opts?: {
  toolId?: string;
  projectPath?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<Session[]> {
  const adapters = getAdapters();
  const filtered = opts?.toolId
    ? adapters.filter(a => a.toolId === opts.toolId)
    : adapters;

  const results = await Promise.all(
    filtered.map(a => a.getSessions(opts?.projectPath))
  );

  // Deduplicate by id — keep the entry with the most recent lastActivity
  const seen = new Map<string, Session>();
  for (const s of results.flat()) {
    const existing = seen.get(s.id);
    if (!existing || new Date(s.lastActivity) > new Date(existing.lastActivity)) {
      seen.set(s.id, s);
    }
  }

  let sessions = Array.from(seen.values())
    .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());

  if (opts?.search) {
    const q = opts.search.toLowerCase();
    sessions = sessions.filter(
      s => s.title.toLowerCase().includes(q) || s.projectPath.toLowerCase().includes(q)
    );
  }

  const offset = opts?.offset ?? 0;
  const limit = opts?.limit ?? 50;
  return sessions.slice(offset, offset + limit);
}

export { getAdapters, getAllProjects, getAllSessions };

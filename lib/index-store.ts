import fs from 'fs';
import path from 'path';
import os from 'os';
import type { Session, Project } from './types';
import { getAdapters } from './registry';

const INDEX_DIR = path.join(os.homedir(), '.session-dashboard');
const INDEX_FILE = path.join(INDEX_DIR, 'index.json');

interface IndexEntry {
  id: string;
  toolId: string;
  projectPath: string;
  title: string;
  messageCount: number;
  startTime: string;
  lastActivity: string;
  filePath: string;
  fileMtime: number;
}

interface IndexFile {
  version: number;
  builtAt: string;
  entries: IndexEntry[];
}

function readIndex(): IndexFile | null {
  try {
    const raw = fs.readFileSync(INDEX_FILE, 'utf8');
    return JSON.parse(raw) as IndexFile;
  } catch {
    return null;
  }
}

function writeIndex(index: IndexFile): void {
  try {
    if (!fs.existsSync(INDEX_DIR)) fs.mkdirSync(INDEX_DIR, { recursive: true });
    fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf8');
  } catch {
    // non-fatal
  }
}

function getAllJsonlFiles(basePath: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(basePath)) return files;
  function walk(dir: string) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile() && entry.name.endsWith('.jsonl')) files.push(p);
    }
  }
  walk(basePath);
  return files;
}

function sessionToEntry(session: Session, filePath: string, fileMtime: number): IndexEntry {
  return {
    id: session.id,
    toolId: session.toolId,
    projectPath: session.projectPath,
    title: session.title,
    messageCount: session.messageCount,
    startTime: new Date(session.startTime).toISOString(),
    lastActivity: new Date(session.lastActivity).toISOString(),
    filePath,
    fileMtime,
  };
}

function entryToSession(e: IndexEntry): Session {
  return {
    id: e.id,
    toolId: e.toolId,
    projectPath: e.projectPath,
    title: e.title,
    messageCount: e.messageCount,
    startTime: new Date(e.startTime),
    lastActivity: new Date(e.lastActivity),
  };
}

function entriesToProjects(entries: IndexEntry[]): Project[] {
  const map = new Map<string, { count: number; lastActivity: Date; toolId: string }>();
  for (const e of entries) {
    const key = `${e.toolId}::${e.projectPath}`;
    const la = new Date(e.lastActivity);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { count: 1, lastActivity: la, toolId: e.toolId });
    } else {
      existing.count++;
      if (la > existing.lastActivity) existing.lastActivity = la;
    }
  }
  return Array.from(map.entries()).map(([key, data]) => {
    const projectPath = key.split('::').slice(1).join('::');
    return {
      id: encodeURIComponent(projectPath),
      path: projectPath,
      toolId: data.toolId,
      sessionCount: data.count,
      lastActivity: data.lastActivity,
    };
  }).sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
}

/**
 * Incrementally update index and return all sessions.
 *
 * For JSONL-based adapters (claude-code, codex): use file-level mtime checks.
 * For non-JSONL adapters (cursor, aider): always call getSessions() since
 * their data sources (SQLite, .md) don't live in the JSONL base path.
 */
export async function getIndexedSessions(): Promise<Session[]> {
  const adapters = getAdapters();
  const current = readIndex();
  const currentMap = new Map<string, IndexEntry>(
    (current?.entries || []).map(e => [e.filePath, e])
  );

  // Adapters that use JSONL files under getBasePath()
  const jsonlAdapterIds = new Set(['claude-code', 'codex']);

  // Collect all known JSONL files with their toolId
  const allFiles: { filePath: string; toolId: string }[] = [];
  for (const adapter of adapters) {
    if (!jsonlAdapterIds.has(adapter.toolId)) continue;
    const base = adapter.getBasePath();
    if (!base || !fs.existsSync(base)) continue;
    for (const f of getAllJsonlFiles(base)) {
      allFiles.push({ filePath: f, toolId: adapter.toolId });
    }
  }

  // Separate fresh (unchanged) vs stale (new or modified) files
  const freshEntries: IndexEntry[] = [];
  const staleByTool = new Map<string, { filePath: string; mtime: number }[]>();
  const liveFilePaths = new Set<string>();

  for (const { filePath, toolId } of allFiles) {
    liveFilePaths.add(filePath);
    let mtime: number;
    try { mtime = fs.statSync(filePath).mtimeMs; } catch { continue; }
    const cached = currentMap.get(filePath);
    if (cached && cached.fileMtime === mtime) {
      freshEntries.push(cached);
    } else {
      if (!staleByTool.has(toolId)) staleByTool.set(toolId, []);
      staleByTool.get(toolId)!.push({ filePath, mtime });
    }
  }

  // For stale files, call the adapter's getSessions() once per tool, then match
  const newEntries: IndexEntry[] = [...freshEntries];

  for (const [toolId, staleFiles] of staleByTool) {
    const adapter = adapters.find(a => a.toolId === toolId);
    if (!adapter) continue;

    // Call getSessions() once - the adapter already has internal mtime caching
    const allSessions = await adapter.getSessions();
    const stalePathSet = new Set(staleFiles.map(s => s.filePath));
    const staleMtimeMap = new Map(staleFiles.map(s => [s.filePath, s.mtime]));

    // Match sessions to files by extracting uuid from session id and file name
    for (const session of allSessions) {
      // Extract uuid portion from session id (e.g. 'cc-uuid' -> 'uuid', 'cdx-uuid' -> 'uuid')
      const uuid = session.id.replace(/^[a-z]+-/, '');

      // Find the matching stale file
      for (const filePath of stalePathSet) {
        const fileName = path.basename(filePath, '.jsonl');
        if (fileName === uuid || fileName.includes(uuid) || uuid.includes(fileName)) {
          const mtime = staleMtimeMap.get(filePath) ?? 0;
          newEntries.push(sessionToEntry(session, filePath, mtime));
          stalePathSet.delete(filePath);
          break;
        }
      }
    }
  }

  // For non-JSONL adapters, always call getSessions() and add as entries with empty filePath
  for (const adapter of adapters) {
    if (jsonlAdapterIds.has(adapter.toolId)) continue;
    try {
      const sessions = await adapter.getSessions();
      for (const s of sessions) {
        newEntries.push({
          id: s.id,
          toolId: s.toolId,
          projectPath: s.projectPath,
          title: s.title,
          messageCount: s.messageCount,
          startTime: new Date(s.startTime).toISOString(),
          lastActivity: new Date(s.lastActivity).toISOString(),
          filePath: '',
          fileMtime: 0,
        });
      }
    } catch {
      // If adapter fails, keep cached entries for this toolId
      const cached = (current?.entries || []).filter(e => e.toolId === adapter.toolId);
      newEntries.push(...cached);
    }
  }

  // Deduplicate by id (keep the one with most recent lastActivity)
  const deduped = new Map<string, IndexEntry>();
  for (const e of newEntries) {
    const existing = deduped.get(e.id);
    if (!existing || new Date(e.lastActivity) > new Date(existing.lastActivity)) {
      deduped.set(e.id, e);
    }
  }

  const finalEntries = [...deduped.values()];

  // Write index asynchronously if anything changed
  if (staleByTool.size > 0 || !current) {
    setImmediate(() => {
      writeIndex({
        version: 1,
        builtAt: new Date().toISOString(),
        entries: finalEntries,
      });
    });
  }

  return finalEntries
    .map(entryToSession)
    .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
}

export async function getIndexedProjects(): Promise<Project[]> {
  // Get sessions via the index, then aggregate into projects
  const adapters = getAdapters();
  const current = readIndex();
  const currentMap = new Map<string, IndexEntry>(
    (current?.entries || []).map(e => [e.filePath, e])
  );

  const jsonlAdapterIds = new Set(['claude-code', 'codex']);

  // Collect entries (reuse same logic as getIndexedSessions for JSONL adapters)
  const allFiles: { filePath: string; toolId: string }[] = [];
  for (const adapter of adapters) {
    if (!jsonlAdapterIds.has(adapter.toolId)) continue;
    const base = adapter.getBasePath();
    if (!base || !fs.existsSync(base)) continue;
    for (const f of getAllJsonlFiles(base)) {
      allFiles.push({ filePath: f, toolId: adapter.toolId });
    }
  }

  const freshEntries: IndexEntry[] = [];
  const staleByTool = new Map<string, { filePath: string; mtime: number }[]>();

  for (const { filePath, toolId } of allFiles) {
    let mtime: number;
    try { mtime = fs.statSync(filePath).mtimeMs; } catch { continue; }
    const cached = currentMap.get(filePath);
    if (cached && cached.fileMtime === mtime) {
      freshEntries.push(cached);
    } else {
      if (!staleByTool.has(toolId)) staleByTool.set(toolId, []);
      staleByTool.get(toolId)!.push({ filePath, mtime });
    }
  }

  const allEntries: IndexEntry[] = [...freshEntries];

  for (const [toolId, staleFiles] of staleByTool) {
    const adapter = adapters.find(a => a.toolId === toolId);
    if (!adapter) continue;
    const allSessions = await adapter.getSessions();
    const stalePathSet = new Set(staleFiles.map(s => s.filePath));
    const staleMtimeMap = new Map(staleFiles.map(s => [s.filePath, s.mtime]));

    for (const session of allSessions) {
      const uuid = session.id.replace(/^[a-z]+-/, '');
      for (const filePath of stalePathSet) {
        const fileName = path.basename(filePath, '.jsonl');
        if (fileName === uuid || fileName.includes(uuid) || uuid.includes(fileName)) {
          const mtime = staleMtimeMap.get(filePath) ?? 0;
          allEntries.push(sessionToEntry(session, filePath, mtime));
          stalePathSet.delete(filePath);
          break;
        }
      }
    }
  }

  // Non-JSONL adapters: call getProjects() directly (more efficient than getSessions)
  const nonJsonlProjects: Project[] = [];
  for (const adapter of adapters) {
    if (jsonlAdapterIds.has(adapter.toolId)) continue;
    try {
      const projects = await adapter.getProjects();
      nonJsonlProjects.push(...projects);
    } catch {
      // skip
    }
  }

  // Deduplicate entries
  const deduped = new Map<string, IndexEntry>();
  for (const e of allEntries) {
    const existing = deduped.get(e.id);
    if (!existing || new Date(e.lastActivity) > new Date(existing.lastActivity)) {
      deduped.set(e.id, e);
    }
  }

  const jsonlProjects = entriesToProjects([...deduped.values()]);
  const combined = [...jsonlProjects, ...nonJsonlProjects]
    .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

  return combined;
}

export function invalidateIndex(): void {
  try {
    if (fs.existsSync(INDEX_FILE)) fs.unlinkSync(INDEX_FILE);
  } catch {
    // non-fatal
  }
}

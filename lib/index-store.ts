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

type IndexedSnapshot = {
  sessions: Session[];
  projects: Project[];
};

const INDEX_SNAPSHOT_TTL_MS = 5_000;
let snapshotCache: { expiresAt: number; payload: IndexedSnapshot } | null = null;
let snapshotInFlight: Promise<IndexedSnapshot> | null = null;

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

function sessionsToProjects(sessions: Session[]): Project[] {
  const map = new Map<string, { count: number; lastActivity: Date; toolId: string }>();
  for (const session of sessions) {
    const key = `${session.toolId}::${session.projectPath}`;
    const la = new Date(session.lastActivity);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { count: 1, lastActivity: la, toolId: session.toolId });
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

async function buildIndexedSnapshot(): Promise<IndexedSnapshot> {
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

  for (const adapter of adapters) {
    if (jsonlAdapterIds.has(adapter.toolId)) continue;
    try {
      const sessions = await adapter.getSessions();
      for (const s of sessions) {
        allEntries.push({
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
      allEntries.push(...cached);
    }
  }

  const deduped = new Map<string, IndexEntry>();
  for (const e of allEntries) {
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

  const sessions = finalEntries
    .map(entryToSession)
    .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());

  return {
    sessions,
    projects: sessionsToProjects(sessions),
  };
}

async function getIndexedSnapshot(): Promise<IndexedSnapshot> {
  if (snapshotCache && snapshotCache.expiresAt > Date.now()) {
    return snapshotCache.payload;
  }

  if (snapshotInFlight) {
    return snapshotInFlight;
  }

  snapshotInFlight = buildIndexedSnapshot()
    .then(payload => {
      snapshotCache = {
        expiresAt: Date.now() + INDEX_SNAPSHOT_TTL_MS,
        payload,
      };
      return payload;
    })
    .finally(() => {
      snapshotInFlight = null;
    });

  return snapshotInFlight;
}

export async function getIndexedSessions(): Promise<Session[]> {
  return (await getIndexedSnapshot()).sessions;
}

export async function getIndexedProjects(): Promise<Project[]> {
  return (await getIndexedSnapshot()).projects;
}

export function clearIndexedSnapshotCache(): void {
  snapshotCache = null;
  snapshotInFlight = null;
}

export function invalidateIndex(): void {
  clearIndexedSnapshotCache();
  try {
    if (fs.existsSync(INDEX_FILE)) fs.unlinkSync(INDEX_FILE);
  } catch {
    // non-fatal
  }
}

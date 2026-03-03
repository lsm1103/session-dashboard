import fs from 'fs';
import os from 'os';
import path from 'path';

const INDEX_FILE = path.join(os.homedir(), '.session-dashboard', 'index.json');

let cachedIndexMtime = -1;
let cachedFileMap = new Map<string, string>();

export function findIndexedFilePathBySessionId(sessionId: string): string | null {
  try {
    const stat = fs.statSync(INDEX_FILE);

    if (stat.mtimeMs !== cachedIndexMtime) {
      const raw = fs.readFileSync(INDEX_FILE, 'utf8');
      const parsed = JSON.parse(raw) as {
        entries?: Array<{ id?: string; filePath?: string }>;
      };

      const nextMap = new Map<string, string>();
      for (const entry of parsed.entries || []) {
        if (entry.id && entry.filePath) {
          nextMap.set(entry.id, entry.filePath);
        }
      }

      cachedIndexMtime = stat.mtimeMs;
      cachedFileMap = nextMap;
    }

    return cachedFileMap.get(sessionId) || null;
  } catch {
    return null;
  }
}

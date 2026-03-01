import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import os from 'os';

const CLAUDE_BASE = path.join(os.homedir(), '.claude', 'projects');
const CODEX_BASE = path.join(os.homedir(), '.codex', 'sessions');

interface SearchResult {
  sessionId: string;
  toolId: string;
  projectPath: string;
  title: string;
  matchCount: number;
  snippet: string;
}

function getAllJsonlFiles(basePath: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(basePath)) return files;

  function walk(dir: string) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
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

function extractSnippet(text: string, query: string): string {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);
  if (idx === -1) return '';

  const start = Math.max(0, idx - 60);
  const end = Math.min(text.length, idx + query.length + 60);
  let snippet = '';
  if (start > 0) snippet += '...';
  const before = text.slice(start, idx);
  const match = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length, end);
  snippet += before + `**${match}**` + after;
  if (end < text.length) snippet += '...';
  return snippet;
}

function countMatches(text: string, query: string): number {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let count = 0;
  let pos = 0;
  while (true) {
    const idx = lowerText.indexOf(lowerQuery, pos);
    if (idx === -1) break;
    count++;
    pos = idx + 1;
  }
  return count;
}

async function searchFile(
  filePath: string,
  query: string,
  toolId: string,
  signal: AbortSignal,
): Promise<SearchResult | null> {
  if (signal.aborted) return null;

  let sessionId = '';
  let projectPath = '';
  let title = '';
  let totalMatches = 0;
  let firstSnippet = '';

  const stream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  try {
    for await (const rawLine of rl) {
      if (signal.aborted) break;
      if (!rawLine.trim()) continue;

      let line: Record<string, unknown>;
      try {
        line = JSON.parse(rawLine);
      } catch {
        continue;
      }

      // Extract metadata
      if (!sessionId && line.sessionId) sessionId = String(line.sessionId);
      if (!projectPath && line.cwd) projectPath = String(line.cwd);

      // For codex session_meta
      if (line.type === 'session_meta') {
        const payload = line.payload as Record<string, unknown> | undefined;
        if (payload) {
          if (payload.id) sessionId = String(payload.id);
          if (payload.cwd) projectPath = String(payload.cwd);
        }
        continue;
      }

      // Search in message content
      let content = '';
      if (line.type === 'user' || line.type === 'assistant') {
        const msg = line.message as Record<string, unknown> | undefined;
        if (msg?.content) {
          if (typeof msg.content === 'string') {
            content = msg.content;
          } else if (Array.isArray(msg.content)) {
            content = (msg.content as Array<Record<string, unknown>>)
              .filter(c => c.type === 'text' || c.type === 'input_text' || c.type === 'output_text')
              .map(c => String(c.text || ''))
              .join('');
          }
        }
      } else if (line.type === 'response_item') {
        const payload = line.payload as Record<string, unknown> | undefined;
        if (payload?.type === 'message') {
          const contentArr = payload.content as Array<Record<string, unknown>> | undefined;
          if (contentArr) {
            content = contentArr
              .filter(c => c.type === 'input_text' || c.type === 'output_text')
              .map(c => String(c.text || ''))
              .join('');
          }
        }
      }

      if (!content) continue;

      // Set title from first user message
      if (!title && (line.type === 'user' || (line.type === 'response_item' && (line.payload as Record<string, unknown>)?.role === 'user'))) {
        title = content.slice(0, 80);
      }

      const matches = countMatches(content, query);
      if (matches > 0) {
        totalMatches += matches;
        if (!firstSnippet) {
          firstSnippet = extractSnippet(content, query);
        }
      }
    }
  } finally {
    rl.close();
    stream.destroy();
  }

  if (totalMatches === 0) return null;

  if (!sessionId) {
    sessionId = path.basename(filePath, '.jsonl');
  }

  const prefix = toolId === 'claude-code' ? 'cc' : 'cdx';

  return {
    sessionId: `${prefix}-${sessionId}`,
    toolId,
    projectPath: projectPath || path.dirname(filePath),
    title: title || 'Untitled session',
    matchCount: totalMatches,
    snippet: firstSnippet,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
  const projectPath = searchParams.get('projectPath') || '';

  if (!query.trim()) {
    return NextResponse.json([]);
  }

  const claudeFiles = getAllJsonlFiles(CLAUDE_BASE).map(f => ({ path: f, toolId: 'claude-code' }));
  const codexFiles = getAllJsonlFiles(CODEX_BASE).map(f => ({ path: f, toolId: 'codex' }));
  const allFiles = [...claudeFiles, ...codexFiles];

  // Timeout protection: 10 seconds max
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 10000);

  try {
    const results: SearchResult[] = [];

    // Process files concurrently in batches to avoid overwhelming the system
    const BATCH_SIZE = 10;
    for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
      if (abortController.signal.aborted) break;

      const batch = allFiles.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(f => searchFile(f.path, query.trim(), f.toolId, abortController.signal))
      );

      for (const r of batchResults) {
        if (r) results.push(r);
      }
    }

    // Filter by projectPath if specified (searchFile already extracts it)
    const filtered = projectPath
      ? results.filter(r => r.projectPath === projectPath)
      : results;

    filtered.sort((a, b) => b.matchCount - a.matchCount);
    return NextResponse.json(filtered.slice(0, limit));
  } finally {
    clearTimeout(timeout);
  }
}

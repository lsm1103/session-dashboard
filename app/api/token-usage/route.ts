import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import os from 'os';

const CLAUDE_BASE = path.join(os.homedir(), '.claude', 'projects');
const CODEX_BASE = path.join(os.homedir(), '.codex', 'sessions');

function getAllJsonlFiles(base: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(base)) return files;
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile() && entry.name.endsWith('.jsonl')) files.push(p);
    }
  }
  walk(base);
  return files;
}

/** 读文件前 N 行，找到 cwd 和 sessionId */
function readFileMeta(filePath: string, toolId: string): { cwd: string; sessionId: string } {
  let cwd = '';
  let sessionId = path.basename(filePath, '.jsonl');
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim()).slice(0, 30);
    for (const raw of lines) {
      try {
        const line = JSON.parse(raw) as Record<string, unknown>;
        if (!cwd && line.cwd) cwd = String(line.cwd);
        if (line.sessionId) sessionId = String(line.sessionId);
        if (toolId === 'codex' && line.type === 'session_meta') {
          const payload = line.payload as Record<string, unknown> | undefined;
          if (payload?.cwd) cwd = String(payload.cwd);
          if (payload?.id) sessionId = String(payload.id);
        }
        if (cwd && sessionId) break;
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return { cwd, sessionId };
}

/** 完整解析一个文件的 token 使用量 */
async function extractTokensFromFile(
  filePath: string,
  toolId: string,
): Promise<{ sessionId: string; cwd: string; title: string; inputTokens: number; outputTokens: number }> {
  let sessionId = path.basename(filePath, '.jsonl');
  let cwd = '';
  let title = '';
  let inputTokens = 0;
  let outputTokens = 0;

  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });

  for await (const raw of rl) {
    if (!raw.trim()) continue;
    let line: Record<string, unknown>;
    try { line = JSON.parse(raw); } catch { continue; }

    if (line.sessionId) sessionId = String(line.sessionId);
    if (!cwd && line.cwd) cwd = String(line.cwd);

    if (toolId === 'claude-code') {
      if (line.type === 'assistant') {
        const msg = line.message as Record<string, unknown> | undefined;
        // usage 可能在 message.usage 或顶层
        const usage = (msg?.usage as Record<string, number> | undefined)
          || (line.usage as Record<string, number> | undefined);
        if (usage && (usage.input_tokens || usage.output_tokens)) {
          inputTokens += usage.input_tokens || 0;
          outputTokens += usage.output_tokens || 0;
        } else {
          // 无 usage 数据时按内容长度估算输出 token
          const content = msg?.content;
          const text = typeof content === 'string' ? content
            : Array.isArray(content)
              ? (content as Record<string, unknown>[]).map(c => String(c.text || '')).join('')
              : '';
          if (text) outputTokens += Math.ceil(text.length / 4);
        }
      }
      if (line.type === 'user' && !title) {
        const msg = line.message as Record<string, unknown> | undefined;
        const content = msg?.content;
        const text = typeof content === 'string' ? content
          : Array.isArray(content)
            ? (content as Record<string, unknown>[])
                .filter(c => (c as Record<string, unknown>).type === 'text')
                .map(c => String((c as Record<string, unknown>).text || ''))
                .join('')
            : '';
        if (text && !text.startsWith('<')) title = text.slice(0, 80);
      }
    } else if (toolId === 'codex') {
      if (line.type === 'session_meta') {
        const payload = line.payload as Record<string, unknown> | undefined;
        if (payload?.cwd) cwd = String(payload.cwd);
        if (payload?.id) sessionId = String(payload.id);
      }
      // usage 可能在顶层或 payload 内
      const usage = (line.usage as Record<string, number> | undefined)
        || ((line.payload as Record<string, unknown>)?.usage as Record<string, number> | undefined);
      if (usage && (usage.input_tokens || usage.output_tokens)) {
        inputTokens += usage.input_tokens || 0;
        outputTokens += usage.output_tokens || 0;
      }
      // 从 response_item message 内容估算
      if (line.type === 'response_item') {
        const payload = line.payload as Record<string, unknown> | undefined;
        if (payload?.type === 'message') {
          const contentArr = payload.content as Array<Record<string, unknown>> | undefined;
          if (contentArr && !usage) {
            const text = contentArr.map(c => String(c.text || '')).join('');
            if (text) outputTokens += Math.ceil(text.length / 4);
          }
          if (!title && payload.role === 'user') {
            const text = contentArr?.filter(c => c.type === 'input_text').map(c => String(c.text)).join('') || '';
            if (text && !text.startsWith('#') && !text.startsWith('<')) title = text.slice(0, 80);
          }
        }
      }
    }
  }

  rl.close();
  if (!title) title = path.basename(filePath, '.jsonl').slice(0, 40);
  return { sessionId, cwd, title, inputTokens, outputTokens };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId') || '';
  const projectPath = searchParams.get('projectPath') || '';

  if (!sessionId && !projectPath) {
    return NextResponse.json({ error: 'sessionId or projectPath required' }, { status: 400 });
  }

  // ── Session 级别：直接按 UUID 定位文件 ──────────────────────
  if (sessionId) {
    const isCC = sessionId.startsWith('cc-');
    const isCDX = sessionId.startsWith('cdx-');
    const uuid = sessionId.replace(/^(cc-|cdx-)/, '');
    const base = isCC ? CLAUDE_BASE : CODEX_BASE;
    const toolId = isCC ? 'claude-code' : 'codex';

    const allFiles = getAllJsonlFiles(base);
    // 先按文件名精确匹配，再按路径包含 uuid 宽松匹配
    const matchFile = allFiles.find(f => path.basename(f, '.jsonl') === uuid)
      || allFiles.find(f => f.includes(uuid));

    if (!matchFile) {
      return NextResponse.json({
        scope: 'session', label: sessionId,
        sessions: [], totals: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      });
    }

    const data = await extractTokensFromFile(matchFile, toolId);
    const total = data.inputTokens + data.outputTokens;
    return NextResponse.json({
      scope: 'session',
      label: data.title || sessionId,
      sessions: [{ id: sessionId, title: data.title, inputTokens: data.inputTokens, outputTokens: data.outputTokens, totalTokens: total }],
      totals: { inputTokens: data.inputTokens, outputTokens: data.outputTokens, totalTokens: total },
    });
  }

  // ── Project 级别：先读前几行获取 cwd，过滤后再全量解析 ──────
  const claudeFiles = getAllJsonlFiles(CLAUDE_BASE);
  const codexFiles = getAllJsonlFiles(CODEX_BASE);

  const matchingFiles: { path: string; toolId: string }[] = [];

  for (const f of claudeFiles) {
    const { cwd } = readFileMeta(f, 'claude-code');
    if (cwd === projectPath) matchingFiles.push({ path: f, toolId: 'claude-code' });
  }
  for (const f of codexFiles) {
    const { cwd } = readFileMeta(f, 'codex');
    if (cwd === projectPath) matchingFiles.push({ path: f, toolId: 'codex' });
  }

  const sessionsData = await Promise.all(
    matchingFiles.map(async f => {
      const data = await extractTokensFromFile(f.path, f.toolId);
      const prefix = f.toolId === 'claude-code' ? 'cc' : 'cdx';
      return { ...data, id: `${prefix}-${data.sessionId}` };
    })
  );

  // 按 id 合并（同一 session 可能出现在多个目录）
  const merged = new Map<string, { id: string; title: string; inputTokens: number; outputTokens: number }>();
  for (const s of sessionsData) {
    const existing = merged.get(s.id);
    if (existing) {
      existing.inputTokens += s.inputTokens;
      existing.outputTokens += s.outputTokens;
    } else {
      merged.set(s.id, { id: s.id, title: s.title, inputTokens: s.inputTokens, outputTokens: s.outputTokens });
    }
  }

  const sessions = [...merged.values()].map(s => ({ ...s, totalTokens: s.inputTokens + s.outputTokens }));
  const totals = sessions.reduce(
    (acc, s) => ({ inputTokens: acc.inputTokens + s.inputTokens, outputTokens: acc.outputTokens + s.outputTokens, totalTokens: acc.totalTokens + s.totalTokens }),
    { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  );

  return NextResponse.json({
    scope: 'project',
    label: path.basename(projectPath),
    sessions,
    totals,
  });
}

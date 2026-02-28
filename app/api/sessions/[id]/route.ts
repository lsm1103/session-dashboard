import { NextRequest, NextResponse } from 'next/server';
import { getAdapters } from '@/lib/registry';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adapters = getAdapters();

    // Route to correct adapter based on ID prefix
    let adapter;
    if (id.startsWith('cc-')) {
      adapter = adapters.find(a => a.toolId === 'claude-code');
    } else if (id.startsWith('cdx-')) {
      adapter = adapters.find(a => a.toolId === 'codex');
    }

    if (!adapter) {
      return NextResponse.json({ error: 'Unknown session type' }, { status: 400 });
    }

    const session = await adapter.getSession(id);
    return NextResponse.json(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load session';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

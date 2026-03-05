import { NextRequest, NextResponse } from 'next/server';
import { analyzeSession } from '@/lib/analysis';
import { getSessionById } from '@/lib/registry';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSessionById(id);
    return NextResponse.json({
      ...session,
      analysis: analyzeSession(session),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load session';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getAllSessions } from '@/lib/registry';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get('toolId') ?? undefined;
    const projectPath = searchParams.get('projectPath') ?? undefined;
    const search = searchParams.get('search') ?? undefined;
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    const sessions = await getAllSessions({ toolId, projectPath, search, limit, offset });
    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Failed to get sessions:', error);
    return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 });
  }
}

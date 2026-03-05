import { NextRequest, NextResponse } from 'next/server';
import { getIndexedSessions } from '@/lib/index-store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get('toolId') ?? undefined;
    const projectPath = searchParams.get('projectPath') ?? undefined;
    const search = searchParams.get('search') ?? undefined;
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    let sessions = await getIndexedSessions();

    // Filter by toolId
    if (toolId) {
      sessions = sessions.filter(s => s.toolId === toolId);
    }

    // Filter by projectPath
    if (projectPath) {
      sessions = sessions.filter(s => s.projectPath === projectPath);
    }

    // Filter by search query
    if (search) {
      const q = search.toLowerCase();
      sessions = sessions.filter(
        s => s.title.toLowerCase().includes(q) || s.projectPath.toLowerCase().includes(q)
      );
    }

    // Paginate
    const result = sessions.slice(offset, offset + limit);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to get sessions:', error);
    return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 });
  }
}

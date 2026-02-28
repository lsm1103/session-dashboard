import { NextResponse } from 'next/server';
import { getAllProjects, getAllSessions } from '@/lib/registry';

export async function GET() {
  try {
    const [projects, recentSessions] = await Promise.all([
      getAllProjects(),
      getAllSessions({ limit: 10 }),
    ]);

    const perTool: Record<string, number> = {};
    for (const project of projects) {
      perTool[project.toolId] = (perTool[project.toolId] ?? 0) + project.sessionCount;
    }

    const totalSessions = Object.values(perTool).reduce((a, b) => a + b, 0);

    return NextResponse.json({
      totalSessions,
      totalProjects: projects.length,
      perTool: Object.entries(perTool).map(([toolId, count]) => ({ toolId, count })),
      recentActivity: recentSessions,
    });
  } catch (error) {
    console.error('Failed to get stats:', error);
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
  }
}

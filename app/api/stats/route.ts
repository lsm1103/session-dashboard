import { NextResponse } from 'next/server';
import { analyzeSession, buildAnalysisOverview } from '@/lib/analysis';
import { getAllProjects, getAllSessions, getSessionById } from '@/lib/registry';

export async function GET() {
  try {
    const [projects, recentSessions] = await Promise.all([
      getAllProjects(),
      getAllSessions({ limit: 24 }),
    ]);

    const perTool: Record<string, number> = {};
    for (const project of projects) {
      perTool[project.toolId] = (perTool[project.toolId] ?? 0) + project.sessionCount;
    }

    const totalSessions = Object.values(perTool).reduce((a, b) => a + b, 0);
    const sessionDetails = await Promise.allSettled(
      recentSessions.map(session => getSessionById(session.id))
    );
    const analyses = sessionDetails
      .filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof getSessionById>>> => (
        result.status === 'fulfilled'
      ))
      .map(result => analyzeSession(result.value));

    return NextResponse.json({
      totalSessions,
      totalProjects: projects.length,
      perTool: Object.entries(perTool).map(([toolId, count]) => ({ toolId, count })),
      recentActivity: recentSessions.slice(0, 10),
      analysisOverview: buildAnalysisOverview(analyses),
    });
  } catch (error) {
    console.error('Failed to get stats:', error);
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
  }
}

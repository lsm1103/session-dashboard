import { NextResponse } from 'next/server';
import { analyzeSession, buildAnalysisOverview } from '@/lib/analysis';
import { getAllProjects, getAllSessions, getSessionById } from '@/lib/registry';

const STATS_TTL_MS = 60_000;
const ANALYSIS_SAMPLE_SIZE = 8;

type StatsPayload = {
  totalSessions: number;
  totalProjects: number;
  perTool: { toolId: string; count: number }[];
  recentActivity: Awaited<ReturnType<typeof getAllSessions>>;
  analysisOverview: ReturnType<typeof buildAnalysisOverview>;
};

let statsCache: { expiresAt: number; payload: StatsPayload } | null = null;

export async function GET() {
  try {
    if (statsCache && statsCache.expiresAt > Date.now()) {
      return NextResponse.json(statsCache.payload);
    }

    const [projects, recentSessions] = await Promise.all([
      getAllProjects(),
      getAllSessions({ limit: 10 }),
    ]);

    const perTool: Record<string, number> = {};
    for (const project of projects) {
      perTool[project.toolId] = (perTool[project.toolId] ?? 0) + project.sessionCount;
    }

    const totalSessions = Object.values(perTool).reduce((a, b) => a + b, 0);
    const sessionDetails = await Promise.allSettled(
      recentSessions.slice(0, ANALYSIS_SAMPLE_SIZE).map(session => getSessionById(session.id))
    );
    const analyses = sessionDetails
      .filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof getSessionById>>> => (
        result.status === 'fulfilled'
      ))
      .map(result => analyzeSession(result.value));

    const payload: StatsPayload = {
      totalSessions,
      totalProjects: projects.length,
      perTool: Object.entries(perTool).map(([toolId, count]) => ({ toolId, count })),
      recentActivity: recentSessions.slice(0, 10),
      analysisOverview: buildAnalysisOverview(analyses),
    };

    statsCache = {
      expiresAt: Date.now() + STATS_TTL_MS,
      payload,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Failed to get stats:', error);
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
  }
}

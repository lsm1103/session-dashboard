import { NextResponse } from 'next/server';
import { getIndexedProjects } from '@/lib/index-store';

type StatsSummaryPayload = {
  totalSessions: number;
  totalProjects: number;
  perTool: { toolId: string; count: number }[];
};

const STATS_SUMMARY_TTL_MS = 15_000;
let statsSummaryCache: { expiresAt: number; payload: StatsSummaryPayload } | null = null;

export async function GET() {
  try {
    if (statsSummaryCache && statsSummaryCache.expiresAt > Date.now()) {
      return NextResponse.json(statsSummaryCache.payload);
    }

    const projects = await getIndexedProjects();
    const perTool: Record<string, number> = {};

    for (const project of projects) {
      perTool[project.toolId] = (perTool[project.toolId] ?? 0) + project.sessionCount;
    }

    const payload: StatsSummaryPayload = {
      totalSessions: Object.values(perTool).reduce((sum, count) => sum + count, 0),
      totalProjects: projects.length,
      perTool: Object.entries(perTool).map(([toolId, count]) => ({ toolId, count })),
    };

    statsSummaryCache = {
      expiresAt: Date.now() + STATS_SUMMARY_TTL_MS,
      payload,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Failed to get stats summary:', error);
    return NextResponse.json({ error: 'Failed to load stats summary' }, { status: 500 });
  }
}

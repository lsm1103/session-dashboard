import { NextResponse } from 'next/server';
import { getIndexedProjects } from '@/lib/index-store';

export async function GET() {
  try {
    const projects = await getIndexedProjects();
    return NextResponse.json(projects);
  } catch (error) {
    console.error('Failed to get projects:', error);
    return NextResponse.json({ error: 'Failed to load projects' }, { status: 500 });
  }
}

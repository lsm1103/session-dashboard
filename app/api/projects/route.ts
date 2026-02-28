import { NextResponse } from 'next/server';
import { getAllProjects } from '@/lib/registry';

export async function GET() {
  try {
    const projects = await getAllProjects();
    return NextResponse.json(projects);
  } catch (error) {
    console.error('Failed to get projects:', error);
    return NextResponse.json({ error: 'Failed to load projects' }, { status: 500 });
  }
}

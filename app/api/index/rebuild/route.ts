import { NextResponse } from 'next/server';
import { invalidateIndex, getIndexedSessions } from '@/lib/index-store';

export async function POST() {
  try {
    invalidateIndex();
    const sessions = await getIndexedSessions();
    return NextResponse.json({ ok: true, count: sessions.length });
  } catch (error) {
    console.error('Failed to rebuild index:', error);
    return NextResponse.json({ error: 'Failed to rebuild index' }, { status: 500 });
  }
}

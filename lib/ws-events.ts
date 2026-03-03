export type RealtimeEvent =
  | { type: 'connected' }
  | { type: 'scan_started'; scope: 'projects' | 'sessions' | 'session' | 'all' }
  | { type: 'scan_progress'; scope: 'projects' | 'sessions' | 'session' | 'all'; completed: number; total?: number }
  | { type: 'projects_dirty' }
  | { type: 'sessions_dirty'; projectId?: string }
  | { type: 'session_dirty'; sessionId: string }
  | { type: 'warning'; message: string }
  | { type: 'error'; message: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isScope(value: unknown): value is 'projects' | 'sessions' | 'session' | 'all' {
  return value === 'projects' || value === 'sessions' || value === 'session' || value === 'all';
}

export function isRealtimeEvent(value: unknown): value is RealtimeEvent {
  if (!isObject(value) || typeof value.type !== 'string') {
    return false;
  }

  switch (value.type) {
    case 'connected':
    case 'projects_dirty':
      return true;
    case 'scan_started':
      return isScope(value.scope);
    case 'scan_progress':
      return isScope(value.scope) && typeof value.completed === 'number' && (
        value.total === undefined || typeof value.total === 'number'
      );
    case 'sessions_dirty':
      return value.projectId === undefined || typeof value.projectId === 'string';
    case 'session_dirty':
      return typeof value.sessionId === 'string';
    case 'warning':
    case 'error':
      return typeof value.message === 'string';
    default:
      return false;
  }
}

export function parseRealtimeEvent(raw: string): RealtimeEvent | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isRealtimeEvent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function getRefreshTargets(event: RealtimeEvent): string[] {
  switch (event.type) {
    case 'projects_dirty':
      return ['projects'];
    case 'sessions_dirty':
      return event.projectId
        ? ['projects', `project-sessions:${event.projectId}`]
        : ['projects', 'project-sessions'];
    case 'session_dirty':
      return [`session:${event.sessionId}`, `session-messages:${event.sessionId}`];
    default:
      return [];
  }
}

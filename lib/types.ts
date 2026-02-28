export interface Project {
  id: string;           // URL-safe encoded path
  path: string;         // actual filesystem path
  toolId: string;       // 'claude-code' | 'codex'
  sessionCount: number;
  lastActivity: Date;
}

export interface Session {
  id: string;
  toolId: string;
  projectPath: string;
  title: string;        // first user message, truncated to 80 chars
  messageCount: number;
  startTime: Date;
  lastActivity: Date;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface SessionDetail extends Session {
  messages: Message[];
}

export interface ISessionAdapter {
  toolId: string;
  getProjects(): Promise<Project[]>;
  getSessions(projectPath?: string): Promise<Session[]>;
  getSession(id: string): Promise<SessionDetail>;
  getBasePath(): string;
}

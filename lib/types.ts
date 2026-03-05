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

export type AnalysisStageType =
  | 'discovery'
  | 'implementation'
  | 'debugging'
  | 'refactor'
  | 'wrap_up';

export interface AnalysisStage {
  stage: AnalysisStageType;
  label: string;
  startTime: Date;
  endTime: Date;
  messageCount: number;
  summary: string;
}

export type DebugActionType =
  | 'search'
  | 'read'
  | 'edit'
  | 'run'
  | 'error'
  | 'retry'
  | 'verify';

export interface DebugAction {
  type: DebugActionType;
  label: string;
  messageId: string;
  timestamp: Date;
}

export interface SessionEfficiency {
  durationMinutes: number;
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  touchedFileCount: number;
  stageSwitches: number;
  debugRatio: number;
  actionCount: number;
  highFriction: boolean;
}

export type WorkflowStyle =
  | 'debug-heavy'
  | 'builder'
  | 'exploratory'
  | 'refactor-focused'
  | 'finisher';

export interface SessionAnalysis {
  toolId: string;
  timeline: AnalysisStage[];
  debugPath: {
    chain: DebugActionType[];
    events: DebugAction[];
  };
  efficiency: SessionEfficiency;
  workflowStyle: WorkflowStyle;
}

export interface AnalysisOverview {
  totalAnalyzedSessions: number;
  mostUsedTool: string;
  averageDurationMinutes: number;
  averageMessages: number;
  averageTouchedFiles: number;
  dominantWorkflowStyle: WorkflowStyle;
  debugHeavyShare: number;
  mostCommonStage: AnalysisStageType;
}

export interface SessionDetail extends Session {
  messages: Message[];
  touchedFiles?: string[];
  analysis?: SessionAnalysis;
}

export interface ISessionAdapter {
  toolId: string;
  getProjects(): Promise<Project[]>;
  getSessions(projectPath?: string): Promise<Session[]>;
  getSession(id: string): Promise<SessionDetail>;
  getBasePath(): string;
}

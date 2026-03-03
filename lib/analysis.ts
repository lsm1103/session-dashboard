import type {
  AnalysisOverview,
  AnalysisStage,
  AnalysisStageType,
  DebugAction,
  DebugActionType,
  Message,
  SessionAnalysis,
  SessionDetail,
  WorkflowStyle,
} from './types';

const STAGE_LABELS: Record<AnalysisStageType, string> = {
  discovery: '需求澄清',
  implementation: '实现',
  debugging: '调试',
  refactor: '重构',
  wrap_up: '收尾',
};

const ACTION_LABELS: Record<DebugActionType, string> = {
  search: '搜索',
  read: '阅读',
  edit: '修改',
  run: '执行',
  error: '报错',
  retry: '重试',
  verify: '验证',
};

const STAGE_PRIORITY: AnalysisStageType[] = [
  'debugging',
  'wrap_up',
  'refactor',
  'implementation',
  'discovery',
];

const WORKFLOW_PRIORITY: WorkflowStyle[] = [
  'debug-heavy',
  'builder',
  'exploratory',
  'refactor-focused',
  'finisher',
];
const analysisCache = new Map<string, SessionAnalysis>();

function includesAny(content: string, keywords: string[]) {
  return keywords.some(keyword => content.includes(keyword));
}

function normalizeContent(message: Message) {
  return message.content.toLowerCase();
}

function classifyStage(message: Message): AnalysisStageType {
  const content = normalizeContent(message);

  if (includesAny(content, [
    'error',
    '失败',
    '报错',
    'bug',
    'cannot',
    'not found',
    'fix',
    'debug',
  ])) {
    return 'debugging';
  }

  if (includesAny(content, [
    '验证通过',
    'build 成功',
    'tests passed',
    'test passed',
    'success',
    '完成',
    '收尾',
    '提交',
    '发布',
    '验证',
  ])) {
    return 'wrap_up';
  }

  if (includesAny(content, [
    'refactor',
    '重构',
    '优化结构',
    '提取',
    '复用',
    'cleanup',
    'clean up',
  ])) {
    return 'refactor';
  }

  if (includesAny(content, [
    '实现',
    '修改',
    'update',
    'patch',
    'create',
    '新增',
    '添加',
    'component',
    'ui',
    'build ',
  ])) {
    return 'implementation';
  }

  return 'discovery';
}

function extractActions(messages: Message[]): DebugAction[] {
  const actions: DebugAction[] = [];
  let sawError = false;

  for (const message of messages) {
    const content = normalizeContent(message);
    const append = (type: DebugActionType) => {
      actions.push({
        type,
        label: ACTION_LABELS[type],
        messageId: message.id,
        timestamp: new Date(message.timestamp),
      });
    };

    if (includesAny(content, ['search', '搜索', '查找', 'grep', 'rg '])) {
      append('search');
    }
    if (includesAny(content, ['read', '读取', '查看', 'open ', '分析现有实现', 'inspect'])) {
      append('read');
    }
    if (includesAny(content, ['edit', '修改', 'patch', '更新', '实现', 'apply patch'])) {
      append('edit');
    }
    if (includesAny(content, ['npm ', 'pnpm ', 'yarn ', 'test', 'build', '运行', 'run '])) {
      append('run');
    }
    if (includesAny(content, ['error', '失败', '报错', 'cannot', 'not found'])) {
      append('error');
      sawError = true;
    }
    if (
      sawError &&
      includesAny(content, ['retry', '重试', '再', '重新', 'again'])
    ) {
      append('retry');
      sawError = false;
    }
    if (includesAny(content, ['验证通过', 'build 成功', 'tests passed', '通过', 'success', '完成交付'])) {
      append('verify');
    }
  }

  return actions;
}

function buildTimeline(messages: Message[]): AnalysisStage[] {
  const timeline: AnalysisStage[] = [];

  for (const message of messages) {
    const stage = classifyStage(message);
    const timestamp = new Date(message.timestamp);
    const last = timeline[timeline.length - 1];

    if (last && last.stage === stage) {
      last.endTime = timestamp;
      last.messageCount += 1;
      last.summary = `${last.label}阶段（${last.messageCount} 条消息）`;
      continue;
    }

    timeline.push({
      stage,
      label: STAGE_LABELS[stage],
      startTime: timestamp,
      endTime: timestamp,
      messageCount: 1,
      summary: `${STAGE_LABELS[stage]}阶段（1 条消息）`,
    });
  }

  return timeline;
}

function countTouchedFiles(session: SessionDetail): number {
  if (session.touchedFiles?.length) {
    return session.touchedFiles.length;
  }

  const filePattern = /(?:\/[\w.-]+)+\.\w+/g;
  const files = new Set<string>();

  for (const message of session.messages) {
    const matches = message.content.match(filePattern) ?? [];
    for (const match of matches) {
      files.add(match);
    }
  }

  return files.size;
}

function deriveWorkflowStyle(timeline: AnalysisStage[], efficiency: SessionAnalysis['efficiency']): WorkflowStyle {
  if (efficiency.highFriction || efficiency.debugRatio >= 0.3) {
    return 'debug-heavy';
  }

  const counts = new Map<AnalysisStageType, number>();
  for (const item of timeline) {
    counts.set(item.stage, (counts.get(item.stage) ?? 0) + item.messageCount);
  }

  let dominant: AnalysisStageType = 'discovery';
  for (const stage of STAGE_PRIORITY) {
    if ((counts.get(stage) ?? 0) > (counts.get(dominant) ?? 0)) {
      dominant = stage;
    }
  }

  switch (dominant) {
    case 'implementation':
      return 'builder';
    case 'refactor':
      return 'refactor-focused';
    case 'wrap_up':
      return 'finisher';
    case 'debugging':
      return 'debug-heavy';
    default:
      return 'exploratory';
  }
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function analyzeSession(session: SessionDetail): SessionAnalysis {
  const cacheKey = `${session.id}:${new Date(session.lastActivity).toISOString()}`;
  const cached = analysisCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const timeline = buildTimeline(session.messages);
  const debugEvents = extractActions(session.messages);
  const durationMinutes = Math.max(
    0,
    Math.round(
      (new Date(session.lastActivity).getTime() - new Date(session.startTime).getTime()) / 60000
    )
  );
  const userMessages = session.messages.filter(message => message.role === 'user').length;
  const assistantMessages = session.messages.length - userMessages;
  const debugMessages = timeline
    .filter(item => item.stage === 'debugging')
    .reduce((sum, item) => sum + item.messageCount, 0);
  const errorCount = debugEvents.filter(event => event.type === 'error').length;
  const retryCount = debugEvents.filter(event => event.type === 'retry').length;

  const efficiency = {
    durationMinutes,
    totalMessages: session.messages.length,
    userMessages,
    assistantMessages,
    touchedFileCount: countTouchedFiles(session),
    stageSwitches: Math.max(0, timeline.length - 1),
    debugRatio: session.messages.length === 0 ? 0 : round(debugMessages / session.messages.length),
    actionCount: debugEvents.length,
    highFriction: errorCount > 0 && retryCount > 0,
  };

  const result: SessionAnalysis = {
    toolId: session.toolId,
    timeline,
    debugPath: {
      chain: debugEvents.map(event => event.type),
      events: debugEvents,
    },
    efficiency,
    workflowStyle: deriveWorkflowStyle(timeline, efficiency),
  };

  if (analysisCache.size > 500) {
    const firstKey = analysisCache.keys().next().value;
    if (firstKey) {
      analysisCache.delete(firstKey);
    }
  }

  analysisCache.set(cacheKey, result);
  return result;
}

export function buildAnalysisOverview(analyses: SessionAnalysis[]): AnalysisOverview {
  const toolCounts = new Map<string, number>();
  for (const analysis of analyses) {
    toolCounts.set(analysis.toolId, (toolCounts.get(analysis.toolId) ?? 0) + 1);
  }

  let mostUsedTool = 'unknown';
  let topToolCount = -1;
  for (const [toolId, count] of toolCounts.entries()) {
    if (count > topToolCount) {
      mostUsedTool = toolId;
      topToolCount = count;
    }
  }

  const workflowCounts = new Map<WorkflowStyle, number>();
  const stageCounts = new Map<AnalysisStageType, number>();

  for (const analysis of analyses) {
    workflowCounts.set(
      analysis.workflowStyle,
      (workflowCounts.get(analysis.workflowStyle) ?? 0) + 1
    );

    for (const stage of analysis.timeline) {
      stageCounts.set(stage.stage, (stageCounts.get(stage.stage) ?? 0) + stage.messageCount);
    }
  }

  let dominantWorkflowStyle: WorkflowStyle = 'exploratory';
  for (const style of WORKFLOW_PRIORITY) {
    if ((workflowCounts.get(style) ?? 0) > (workflowCounts.get(dominantWorkflowStyle) ?? 0)) {
      dominantWorkflowStyle = style;
    }
  }

  let mostCommonStage: AnalysisStageType = 'discovery';
  for (const stage of STAGE_PRIORITY) {
    if ((stageCounts.get(stage) ?? 0) > (stageCounts.get(mostCommonStage) ?? 0)) {
      mostCommonStage = stage;
    }
  }

  const debugHeavyCount = analyses.filter(analysis => analysis.workflowStyle === 'debug-heavy').length;

  return {
    totalAnalyzedSessions: analyses.length,
    mostUsedTool,
    averageDurationMinutes: average(analyses.map(analysis => analysis.efficiency.durationMinutes)),
    averageMessages: average(analyses.map(analysis => analysis.efficiency.totalMessages)),
    averageTouchedFiles: average(analyses.map(analysis => analysis.efficiency.touchedFileCount)),
    dominantWorkflowStyle,
    debugHeavyShare: analyses.length === 0 ? 0 : round(debugHeavyCount / analyses.length),
    mostCommonStage,
  };
}

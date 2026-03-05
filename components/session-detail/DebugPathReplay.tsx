import type { DebugActionType, SessionAnalysis } from '@/lib/types';

const ACTION_LABELS: Record<DebugActionType, string> = {
  search: '搜索',
  read: '阅读',
  edit: '修改',
  run: '执行',
  error: '报错',
  retry: '重试',
  verify: '验证',
};

function formatTime(value: Date) {
  return new Date(value).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DebugPathReplay({ debugPath }: { debugPath: SessionAnalysis['debugPath'] }) {
  if (debugPath.events.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card/70 p-3">
        <p className="text-xs text-muted-foreground mb-2">调试路径回放</p>
        <p className="text-xs text-muted-foreground">这次 session 没有检测到明显的调试动作链。</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card/70 p-3">
      <p className="text-xs text-muted-foreground mb-3">调试路径回放</p>
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {debugPath.chain.map((type, index) => (
          <div key={`${type}-${index}`} className="flex items-center gap-1.5">
            <span className="text-[11px] px-2 py-1 rounded-full bg-accent/60 text-foreground">
              {ACTION_LABELS[type]}
            </span>
            {index < debugPath.chain.length - 1 && (
              <span className="text-[11px] text-muted-foreground">→</span>
            )}
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        {debugPath.events.slice(-6).map((event, index) => (
          <div key={`${event.messageId}-${index}`} className="flex items-center justify-between text-xs">
            <span className="text-foreground/85">{ACTION_LABELS[event.type]}</span>
            <span className="text-muted-foreground">{formatTime(event.timestamp)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

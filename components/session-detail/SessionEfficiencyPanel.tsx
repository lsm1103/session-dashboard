import type { SessionEfficiency, WorkflowStyle } from '@/lib/types';

const WORKFLOW_LABELS: Record<WorkflowStyle, string> = {
  'debug-heavy': '调试驱动',
  builder: '实现驱动',
  exploratory: '探索驱动',
  'refactor-focused': '重构驱动',
  finisher: '收尾驱动',
};

export function SessionEfficiencyPanel({
  efficiency,
  workflowStyle,
}: {
  efficiency: SessionEfficiency;
  workflowStyle: WorkflowStyle;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/70 p-3">
      <p className="text-xs text-muted-foreground mb-3">效率信号</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        <div className="rounded-md bg-accent/40 px-2.5 py-2">
          <p className="text-muted-foreground">工作模式</p>
          <p className="text-foreground font-medium mt-1">{WORKFLOW_LABELS[workflowStyle]}</p>
        </div>
        <div className="rounded-md bg-accent/40 px-2.5 py-2">
          <p className="text-muted-foreground">时长</p>
          <p className="text-foreground font-medium mt-1">{efficiency.durationMinutes}m</p>
        </div>
        <div className="rounded-md bg-accent/40 px-2.5 py-2">
          <p className="text-muted-foreground">消息数</p>
          <p className="text-foreground font-medium mt-1">{efficiency.totalMessages}</p>
        </div>
        <div className="rounded-md bg-accent/40 px-2.5 py-2">
          <p className="text-muted-foreground">文件触达</p>
          <p className="text-foreground font-medium mt-1">{efficiency.touchedFileCount}</p>
        </div>
        <div className="rounded-md bg-accent/40 px-2.5 py-2">
          <p className="text-muted-foreground">阶段切换</p>
          <p className="text-foreground font-medium mt-1">{efficiency.stageSwitches}</p>
        </div>
        <div className={`rounded-md px-2.5 py-2 ${efficiency.highFriction ? 'bg-amber-500/10' : 'bg-accent/40'}`}>
          <p className="text-muted-foreground">调试密度</p>
          <p className={`font-medium mt-1 ${efficiency.highFriction ? 'text-amber-500' : 'text-foreground'}`}>
            {Math.round(efficiency.debugRatio * 100)}%
          </p>
        </div>
      </div>
      {efficiency.highFriction && (
        <p className="text-[11px] text-amber-500 mt-3">
          检测到高摩擦调试：本次 session 出现了报错后重试的循环。
        </p>
      )}
    </div>
  );
}

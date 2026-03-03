import type { AnalysisStage } from '@/lib/types';

function formatTime(value: Date) {
  return new Date(value).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NarrativeTimeline({ timeline }: { timeline: AnalysisStage[] }) {
  if (timeline.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card/70 p-3">
      <p className="text-xs text-muted-foreground mb-3">叙事时间线</p>
      <div className="space-y-2">
        {timeline.map((item, index) => (
          <div key={`${item.stage}-${index}`} className="flex gap-3">
            <div className="flex flex-col items-center pt-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              {index < timeline.length - 1 && (
                <div className="w-px flex-1 bg-border/70 mt-1 min-h-6" />
              )}
            </div>
            <div className="min-w-0 flex-1 pb-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{item.label}</p>
                <span className="text-[11px] text-muted-foreground">
                  {formatTime(item.startTime)} - {formatTime(item.endTime)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{item.summary}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

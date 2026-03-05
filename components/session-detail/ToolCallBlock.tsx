'use client';

interface ToolUseProps {
  name: string;
  input: string;
}

interface ToolResultProps {
  output: string;
}

export function ToolUseBlock({ name, input }: ToolUseProps) {
  return (
    <details className="my-2 rounded-lg border border-border/60 bg-muted/30 text-xs group" open={false}>
      <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none list-none hover:bg-accent/30 rounded-lg transition-colors">
        <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
        </svg>
        <span className="font-mono font-medium text-amber-400">{name}</span>
        <span className="text-muted-foreground ml-auto text-[10px] group-open:hidden">展开参数</span>
      </summary>
      <pre className="px-3 pb-3 pt-1 font-mono text-[11px] text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words">
        {input}
      </pre>
    </details>
  );
}

export function ToolResultBlock({ output }: ToolResultProps) {
  return (
    <details className="my-1 rounded-lg border border-border/40 bg-background/50 text-xs" open={false}>
      <summary className="flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none list-none hover:bg-accent/20 rounded-lg transition-colors">
        <svg className="w-3 h-3 text-muted-foreground shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l3 3m0 0l3-3m-3 3v-7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-muted-foreground">工具返回</span>
      </summary>
      <pre className="px-3 pb-2 pt-1 font-mono text-[11px] text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words">
        {output}
      </pre>
    </details>
  );
}

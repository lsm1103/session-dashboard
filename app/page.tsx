import Link from 'next/link';
import { StatsPanel } from '@/components/dashboard/StatsPanel';

export default function DashboardPage() {
  return (
    <div className="min-h-screen px-6 py-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">仪表板</h1>
        <Link
          href="/sessions"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          查看 Sessions →
        </Link>
      </div>
      <StatsPanel />
    </div>
  );
}

import Link from 'next/link';
import { StatsPanel } from '@/components/dashboard/StatsPanel';
import { ActivityChart } from '@/components/dashboard/ActivityChart';
import { TopProjects } from '@/components/dashboard/TopProjects';
import { DeveloperProfileCard } from '@/components/dashboard/DeveloperProfileCard';
import { EfficiencyInsightsCard } from '@/components/dashboard/EfficiencyInsightsCard';

export default function DashboardPage() {
  return (
    <div className="min-h-screen overflow-y-auto px-6 py-6 max-w-3xl">
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
      <div className="mt-6">
        <ActivityChart />
      </div>
      <div className="mt-4">
        <TopProjects />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <DeveloperProfileCard />
        <EfficiencyInsightsCard />
      </div>
    </div>
  );
}

import { useState } from 'react';
import { AppShell } from '@/layouts/AppShell';
import { JobCard } from '@/components/domain/JobCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { recommendedJobs } from '@/lib/mockData';
import type { AuthUser, ScoredJob } from '@/types';

export function CandidateDashboardPage({ user }: { user: AuthUser }) {
  const [jobs, setJobs] = useState<ScoredJob[]>([...recommendedJobs].sort((a, b) => b.match_score - a.match_score || a.title.localeCompare(b.title) || a.id.localeCompare(b.id)));
  const [loading, setLoading] = useState(false);

  async function handleApply(jobId: string) {
    setLoading(true);
    // TODO: Replace with real API call
    await new Promise((r) => setTimeout(r, 600));
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, has_applied: true } : j))
    );
    setLoading(false);
  }

  return (
    <AppShell user={user}>
      <div className="mb-8">
        <p className="mb-2 text-sm font-bold uppercase tracking-[0.15em] text-accent">Your matches</p>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">Recommended jobs</h1>
        <p className="mt-2 text-text-secondary">Roles ranked by how closely they fit your skills.</p>
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : jobs.length === 0 ? (
        <EmptyState title="No jobs yet" description="Check back later." />
      ) : (
        <div className="flex flex-col gap-4">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} onApply={handleApply} />
          ))}
        </div>
      )}
    </AppShell>
  );
}

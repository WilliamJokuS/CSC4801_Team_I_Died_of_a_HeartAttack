
import { AppShell } from '@/layouts/AppShell';
import { Card } from '@/components/ui/Card';
import { MatchScoreBadge } from '@/components/domain/MatchScoreBadge';
import { ApplicationStatusBadge } from '@/components/domain/ApplicationStatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { applicants } from '@/lib/mockData';
import type { AuthUser } from '@/types';

export function EmployerApplicantsPage({ user }: { user: AuthUser }) {
  return (
    <AppShell user={user}>
      <h1 className="mb-6 text-2xl font-bold text-text-primary">
        Applicants — Senior Python Developer
      </h1>
      {applicants.length === 0 ? (
        <EmptyState title="No applicants yet" />
      ) : (
        <div className="flex flex-col gap-4">
          {applicants.map((app) => (
            <Card key={app.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-text-primary">
                    {app.candidate_display_name}
                  </h3>
                  <p className="text-sm text-text-secondary">{app.candidate_skills.join(', ')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <MatchScoreBadge score={app.match_score} />
                  <ApplicationStatusBadge status={app.status} />
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-text-primary"
                  defaultValue={app.status}
                  onChange={(e) => {
                    // TODO: Replace with real API call
                    console.log('status change', app.id, e.target.value);
                  }}
                >
                  {(['Pending', 'Interviewing', 'Rejected', 'Accepted'] as const).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}


import { AppShell } from '@/layouts/AppShell';
import { ApplicationStatusBadge } from '@/components/domain/ApplicationStatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { myApplications } from '@/lib/mockData';
import type { AuthUser } from '@/types';

export function CandidateApplicationsPage({ user }: { user: AuthUser }) {
  return (
    <AppShell user={user}>
      <h1 className="mb-6 text-2xl font-bold text-text-primary">My Applications</h1>
      {myApplications.length === 0 ? (
        <EmptyState
          title="You haven't applied to any jobs yet."
          description="Browse the dashboard to find opportunities."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {myApplications.map((app) => (
            <Card key={app.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-text-primary">{app.job_title}</h3>
                  <p className="text-sm text-text-secondary">{app.company_name}</p>
                </div>
                <ApplicationStatusBadge status={app.status} />
              </div>
              {app.interview_slot && (
                <p className="text-sm text-text-secondary">
                  Interview: {app.interview_slot.start_time}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}


import { AppShell } from '@/layouts/AppShell';
import { Card } from '@/components/ui/Card';
import { Link } from 'react-router-dom';
import { employerJobs } from '@/lib/mockData';
import type { AuthUser } from '@/types';

export function EmployerDashboardPage({ user }: { user: AuthUser }) {
  const totalApplicants = 12;
  const pendingReviews = 5;

  return (
    <AppShell user={user}>
      <div className="mb-8">
        <p className="mb-2 text-sm font-bold uppercase tracking-[0.15em] text-accent">Overview</p>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">Good morning, {user.display_name.split(' ')[0]}</h1>
        <p className="mt-2 text-text-secondary">Here is what is happening across your hiring pipeline.</p>
      </div>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-text-secondary">Active Jobs</p>
          <p className="text-3xl font-bold text-text-primary">{employerJobs.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-secondary">Total Applicants</p>
          <p className="text-3xl font-bold text-text-primary">{totalApplicants}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-secondary">Pending Reviews</p>
          <p className="text-3xl font-bold text-text-primary">{pendingReviews}</p>
        </Card>
      </div>
      <Card>
        <h2 className="mb-2 text-lg font-semibold text-text-primary">Quick links</h2>
        <ul className="flex flex-col gap-2">
          {employerJobs.map((job) => (
            <li key={job.id}>
              <Link to={`/employer/jobs/${job.id}/applicants`} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-text-primary transition hover:bg-surface hover:text-accent">
                <span className="font-medium">{job.title}</span><span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </AppShell>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '@/layouts/AppShell';
import { SkillList } from '@/components/domain/SkillList';
import { ConfirmDialog } from '@/components/domain/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { SkillTagInput } from '@/components/ui/SkillTagInput';
import { employerJobs } from '@/lib/mockData';
import type { AuthUser, ScoredJob } from '@/types';

interface DraftJob {
  title: string;
  description: string;
  required_skills: string[];
}

const emptyDraft: DraftJob = { title: '', description: '', required_skills: [] };

export function EmployerJobsPage({ user }: { user: AuthUser }) {
  const [jobs, setJobs] = useState<ScoredJob[]>(employerJobs);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftJob>(emptyDraft);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId('new');
    setDraft(emptyDraft);
    setError(null);
  };

  const openEdit = (job: ScoredJob) => {
    setEditingId(job.id);
    setDraft({ title: job.title, description: job.description, required_skills: job.required_skills });
    setError(null);
  };

  const saveJob = () => {
    if (!draft.title.trim() || !draft.description.trim()) {
      setError('Add a title and description before saving.');
      return;
    }
    if (editingId === 'new') {
      setJobs((current) => [
        {
          id: `job-${Date.now()}`,
          employer_id: user.id,
          company_name: 'TechCorp Inc.',
          title: draft.title.trim(),
          description: draft.description.trim(),
          required_skills: draft.required_skills,
          is_active: true,
          created_at: new Date().toISOString(),
          match_score: 0,
          has_applied: false,
        },
        ...current,
      ]);
    } else {
      setJobs((current) => current.map((job) => job.id === editingId ? { ...job, ...draft, title: draft.title.trim(), description: draft.description.trim() } : job));
    }
    setEditingId(null);
  };

  return (
    <AppShell user={user}>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.15em] text-accent">Hiring pipeline</p>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">Job postings</h1>
          <p className="mt-2 text-text-secondary">Create roles and manage the candidates they attract.</p>
        </div>
        <Button size="sm" className="self-start rounded-xl sm:self-auto" onClick={openCreate}>+ Create new job</Button>
      </div>

      {jobs.length === 0 ? (
        <EmptyState title="No postings yet" description="Create your first job posting." action={<Button onClick={openCreate}>Create a job</Button>} />
      ) : (
        <div className="flex flex-col gap-4">
          {jobs.map((job) => (
            <Card key={job.id} className="flex flex-col gap-4 transition hover:border-accent/25 hover:shadow-md">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-text-primary">{job.title}</h3>
                    <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-bold text-success">Active</span>
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">Posted {new Date(job.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/employer/jobs/${job.id}/applicants`} className="inline-flex items-center justify-center rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text-primary transition hover:bg-surface">Applicants</Link>
                  <Link to={`/employer/jobs/${job.id}/availability`} className="inline-flex items-center justify-center rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text-primary transition hover:bg-surface">Availability</Link>
                  <Button variant="secondary" size="sm" onClick={() => openEdit(job)}>Edit</Button>
                  <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-bg" onClick={() => setDeleteId(job.id)}>Delete</Button>
                </div>
              </div>
              <SkillList skills={job.required_skills} />
            </Card>
          ))}
        </div>
      )}

      <Modal open={editingId !== null} onClose={() => setEditingId(null)} title={editingId === 'new' ? 'Create a job' : 'Edit job'}>
        <div className="flex flex-col gap-4">
          {error && <p role="alert" className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}
          <Input label="Job title" name="jobTitle" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          <Textarea label="Description" name="jobDescription" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
          <SkillTagInput label="Required skills" skills={draft.required_skills} onChange={(skills) => setDraft({ ...draft, required_skills: skills })} />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
            <Button onClick={saveJob}>Save job</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete job posting?"
        message="This removes the posting from your workspace. This demo action cannot be undone."
        confirmLabel="Delete job"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          setJobs((current) => current.filter((job) => job.id !== deleteId));
          setDeleteId(null);
        }}
      />
    </AppShell>
  );
}

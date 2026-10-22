// Employer screens: company profile (FP-EMP-1), job CRUD (FP-EMP-2),
// applicants + status (FP-EMP-3), availability slots (FP-SCHED-1).
import { useEffect, useState, type FormEvent } from 'react';
import { applicationsApi, jobsApi, profileApi, schedulingApi } from '../api/endpoints';
import { Message, Skills, Status, formatTime, parseSkills, useAction, useLoad } from '../lib';
import { APPLICATION_STATUSES, type ApplicationStatus, type Job } from '../types';

export function CompanyProfilePage() {
  const { data, error, loading } = useLoad(profileApi.getCompany);
  const [companyName, setCompanyName] = useState('');
  const [description, setDescription] = useState('');
  const { busy, message, run } = useAction();

  useEffect(() => {
    if (!data) return;
    setCompanyName(data.company_name);
    setDescription(data.description);
  }, [data]);

  function save(e: FormEvent) {
    e.preventDefault();
    void run(() => profileApi.updateCompany({ company_name: companyName, description }), 'Company profile saved');
  }

  return (
    <section className="card">
      <h2>Company profile</h2>
      <Status error={error} loading={loading} />
      {data && (
        <form onSubmit={save}>
          <label>
            Company name
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
          </label>
          <label>
            Description
            <textarea rows={6} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <button disabled={busy}>Save</button>
        </form>
      )}
      <Message message={message} />
    </section>
  );
}

export function EmployerJobsPage() {
  const { data, error, loading, reload } = useLoad(jobsApi.listMine);
  const [editing, setEditing] = useState<Job | 'new' | null>(null);
  const [viewingApplicants, setViewingApplicants] = useState<Job | null>(null);
  const { busy, message, run } = useAction();

  if (viewingApplicants) {
    return <ApplicantsPanel job={viewingApplicants} onBack={() => setViewingApplicants(null)} />;
  }

  return (
    <section className="card">
      <h2>My job postings</h2>
      <Status error={error} loading={loading} />
      <Message message={message} />
      {editing ? (
        <JobForm
          // Remount per job so switching "Edit" between jobs reloads the form's fields.
          key={editing === 'new' ? 'new' : editing.id}
          job={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      ) : (
        <button onClick={() => setEditing('new')}>New job</button>
      )}
      {data?.length === 0 && <p className="muted">No postings yet.</p>}
      {data && data.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Required skills</th>
              <th>Tags</th>
              <th>Applicants</th>
              <th>Posted</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.map((job) => (
              <tr key={job.id}>
                <td>{job.title}</td>
                <td>
                  <Skills skills={job.required_skills} />
                </td>
                <td>
                  <Skills skills={job.tags} />
                </td>
                <td>{job.applicant_count}</td>
                <td>{formatTime(job.created_at)}</td>
                <td className="actions">
                  <button onClick={() => setViewingApplicants(job)}>Applicants</button>
                  <button onClick={() => setEditing(job)}>Edit</button>
                  <button
                    className="danger"
                    disabled={busy || job.applicant_count > 0}
                    title={job.applicant_count > 0 ? 'Jobs with applicants cannot be deleted' : undefined}
                    onClick={() => {
                      if (confirm(`Delete "${job.title}"?`)) {
                        void run(() => jobsApi.remove(job.id), 'Job deleted', reload);
                      }
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function JobForm({ job, onCancel, onSaved }: { job: Job | null; onCancel: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(job?.title ?? '');
  const [description, setDescription] = useState(job?.description ?? '');
  const [skills, setSkills] = useState(job?.required_skills.join(', ') ?? '');
  const [tags, setTags] = useState(job?.tags.join(', ') ?? '');
  const { busy, message, run } = useAction();

  function save(e: FormEvent) {
    e.preventDefault();
    // Always send tags: PUT replaces the whole job, so omitting them would clear them.
    const input = { title, description, required_skills: parseSkills(skills), tags: parseSkills(tags) };
    void run(() => (job ? jobsApi.update(job.id, input) : jobsApi.create(input)), undefined, onSaved);
  }

  return (
    <form onSubmit={save} className="subcard">
      <h3>{job ? 'Edit job' : 'New job'}</h3>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label>
        Description
        <textarea rows={6} value={description} onChange={(e) => setDescription(e.target.value)} required />
      </label>
      <label>
        Required skills (comma separated, may be empty)
        <input value={skills} onChange={(e) => setSkills(e.target.value)} />
      </label>
      <label>
        Tags (comma separated, e.g. Remote, Full-time)
        <input value={tags} onChange={(e) => setTags(e.target.value)} />
      </label>
      <div className="actions">
        <button disabled={busy}>Save</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <Message message={message} />
    </form>
  );
}

function ApplicantsPanel({ job, onBack }: { job: Job; onBack: () => void }) {
  const { data, error, loading, reload } = useLoad(() => applicationsApi.listApplicants(job.id));
  const { busy, message, run } = useAction();

  function setStatus(applicationId: string, status: ApplicationStatus) {
    void run(() => applicationsApi.setStatus(applicationId, status), `Status set to ${status}`, reload);
  }

  return (
    <section className="card">
      <button className="link" onClick={onBack}>
        ← Back to postings
      </button>
      <h2>Applicants: {job.title}</h2>
      <p className="muted">Sorted by match score, highest first.</p>
      <Status error={error} loading={loading} />
      <Message message={message} />
      {data?.length === 0 && <p className="muted">No applicants yet.</p>}
      {data && data.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Score</th>
              <th>Candidate</th>
              <th>Skills</th>
              <th>Status</th>
              <th>Interview</th>
            </tr>
          </thead>
          <tbody>
            {data.map((app) => (
              <tr key={app.id}>
                <td>{app.match_score}</td>
                <td>{app.candidate.display_name}</td>
                <td>
                  <Skills skills={app.candidate.skills} />
                </td>
                <td>
                  <select
                    value={app.status}
                    disabled={busy}
                    onChange={(e) => setStatus(app.id, e.target.value as ApplicationStatus)}
                  >
                    {APPLICATION_STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td>{app.interview_slot ? formatTime(app.interview_slot.start_time) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

const SLOT_MINUTES = 30;

export function AvailabilityPage() {
  const { data, error, loading, reload } = useLoad(schedulingApi.listMySlots);
  const [start, setStart] = useState('');
  const { busy, message, run } = useAction();

  function create(e: FormEvent) {
    e.preventDefault();
    // datetime-local is the browser's local time; send exact UTC instants (FP-SCHED-1).
    const startDate = new Date(start);
    const endDate = new Date(startDate.getTime() + SLOT_MINUTES * 60_000);
    void run(
      () => schedulingApi.createSlot({ start_time: startDate.toISOString(), end_time: endDate.toISOString() }),
      'Slot created',
      reload,
    );
  }

  return (
    <section className="card">
      <h2>Interview availability</h2>
      <p className="muted">30-minute slots, shown in your local timezone, stored in UTC.</p>
      <form onSubmit={create} className="inline">
        <label>
          Start
          <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
        </label>
        <button disabled={busy}>Add slot</button>
      </form>
      <Message message={message} />
      <Status error={error} loading={loading} />
      {data?.length === 0 && <p className="muted">No slots yet.</p>}
      {data && data.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Start</th>
              <th>End</th>
              <th>Booked by</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.map((slot) => (
              <tr key={slot.id}>
                <td>{formatTime(slot.start_time)}</td>
                <td>{formatTime(slot.end_time)}</td>
                <td>
                  {slot.booking ? `${slot.booking.candidate_display_name} (${slot.booking.job_title})` : '—'}
                </td>
                <td>
                  <button
                    className="danger"
                    disabled={busy}
                    onClick={() => void run(() => schedulingApi.deleteSlot(slot.id), 'Slot deleted', reload)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// Candidate screens: profile + resume (FP-CAN-1), job dashboard (FP-CAN-2),
// applications + booking (FP-CAN-3, FP-SCHED-2).
import { Fragment, useEffect, useState, type FormEvent } from 'react';
import { applicationsApi, jobsApi, profileApi, schedulingApi } from '../api/endpoints';
import { Message, Skills, Status, formatTime, parseSkills, useAction, useLoad } from '../lib';
import type { AvailabilitySlot, ScoredApplication } from '../types';

export function CandidateProfilePage() {
  const { data, error, loading } = useLoad(profileApi.getCandidate);
  const [displayName, setDisplayName] = useState('');
  const [skills, setSkills] = useState('');
  const [resume, setResume] = useState('');
  const { busy, message, run } = useAction();

  useEffect(() => {
    if (!data) return;
    setDisplayName(data.display_name);
    setSkills(data.skills.join(', '));
    setResume(data.resume_text);
  }, [data]);

  function save(e: FormEvent) {
    e.preventDefault();
    void run(async () => {
      const saved = await profileApi.updateCandidate({
        display_name: displayName,
        skills: parseSkills(skills),
        resume_text: resume,
      });
      // Show what the server actually stored (skills come back normalized).
      setSkills(saved.skills.join(', '));
    }, 'Profile saved');
  }

  return (
    <section className="card">
      <h2>My profile</h2>
      <Status error={error} loading={loading} />
      {data && (
        <form onSubmit={save}>
          <label>
            Display name
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </label>
          <label>
            Skills (comma separated)
            <input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="python, sql" />
          </label>
          <label>
            Resume (plain text, private to you)
            <textarea rows={10} value={resume} onChange={(e) => setResume(e.target.value)} />
          </label>
          <button disabled={busy}>Save</button>
        </form>
      )}
      <Message message={message} />
    </section>
  );
}

export function CandidateJobsPage() {
  const { data, error, loading, reload } = useLoad(jobsApi.listScored);
  const [open, setOpen] = useState<string | null>(null);
  const { busy, message, run } = useAction();

  return (
    <section className="card">
      <h2>Jobs for you</h2>
      <p className="muted">Sorted by match score, highest first.</p>
      <Status error={error} loading={loading} />
      <Message message={message} />
      {data?.length === 0 && <p className="muted">No jobs posted yet.</p>}
      {data && data.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Score</th>
              <th>Title</th>
              <th>Company</th>
              <th>Required skills</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.map((job) => (
              <Fragment key={job.id}>
                <tr>
                  <td>{job.match_score}</td>
                  <td>{job.title}</td>
                  <td>{job.company_name}</td>
                  <td>
                    <Skills skills={job.required_skills} />
                  </td>
                  <td className="actions">
                    <button className="link" onClick={() => setOpen(open === job.id ? null : job.id)}>
                      {open === job.id ? 'Hide' : 'Details'}
                    </button>
                    {job.has_applied ? (
                      <span className="muted">Applied</span>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() => void run(() => applicationsApi.apply(job.id), `Applied to ${job.title}`, reload)}
                      >
                        Apply
                      </button>
                    )}
                  </td>
                </tr>
                {open === job.id && (
                  <tr>
                    <td colSpan={5} className="pre">
                      {job.description}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function CandidateApplicationsPage() {
  const { data, error, loading, reload } = useLoad(applicationsApi.listMine);

  return (
    <section className="card">
      <h2>My applications</h2>
      <Status error={error} loading={loading} />
      {data?.length === 0 && <p className="muted">You haven't applied to anything yet.</p>}
      {data && data.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Job</th>
              <th>Company</th>
              <th>Score</th>
              <th>Status</th>
              <th>Interview</th>
            </tr>
          </thead>
          <tbody>
            {data.map((app) => (
              <tr key={app.id}>
                <td>{app.job.title}</td>
                <td>{app.job.company_name}</td>
                <td>{app.match_score}</td>
                <td>{app.status}</td>
                <td>
                  <Booking app={app} onBooked={reload} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Booking({ app, onBooked }: { app: ScoredApplication; onBooked: () => unknown }) {
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null);
  const { busy, message, run } = useAction();

  if (app.interview_slot) return <span>{formatTime(app.interview_slot.start_time)}</span>;
  if (app.interview_slot_id) return <span>Booked</span>;
  if (app.status !== 'Interviewing') return <span className="muted">—</span>;

  return (
    <div>
      {slots === null ? (
        <button
          disabled={busy}
          onClick={() => void run(async () => setSlots(await schedulingApi.availableSlots(app.id)))}
        >
          Pick a slot
        </button>
      ) : slots.length === 0 ? (
        <span className="muted">No open slots</span>
      ) : (
        <ul className="plain">
          {slots.map((slot) => (
            <li key={slot.id}>
              {formatTime(slot.start_time)}{' '}
              <button
                disabled={busy}
                onClick={() => void run(() => schedulingApi.book(app.id, slot.id), 'Booked', onBooked)}
              >
                Book
              </button>
            </li>
          ))}
        </ul>
      )}
      <Message message={message} />
    </div>
  );
}

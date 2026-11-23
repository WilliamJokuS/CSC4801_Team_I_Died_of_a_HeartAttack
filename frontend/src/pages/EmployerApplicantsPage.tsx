import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { applicationsApi, jobsApi } from '../api/endpoints'
import ApplicationStatusBadge from '../components/ApplicationStatusBadge'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import LoadingScreen from '../components/LoadingScreen'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import {
  needsStatusChangeConfirm,
  statusChangeConfirmMessage,
} from '../lib/applicationStatusConfirm'
import { apiErrorMessage } from '../lib/apiErrorMessage'
import { formatDateTime } from '../lib/formatDateTime'
import { interviewSummary } from '../lib/interviewDisplay'
import { candidateHasSkill, matchScoreBadgeClass } from '../lib/matchScoreStyles'
import { missingRequiredSkills } from '../lib/missingSkills'
import { normalizeEmployerJob, normalizeScoredApplication } from '../lib/normalizeApi'
import {
  getPreviewEmployerJob,
  loadPreviewJobApplicants,
  updatePreviewApplicantStatus,
} from '../lib/employerPreview'
import { isPreviewUser } from '../lib/preview'
import type { ApplicationStatus, EmployerJob, ScoredApplication } from '../types'

const STATUS_OPTIONS: ApplicationStatus[] = ['Pending', 'Interviewing', 'Rejected', 'Accepted']
type StatusFilter = 'All' | ApplicationStatus

function EmployerApplicantsPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const { user } = useAuth()
  const previewMode = isPreviewUser(user?.id)
  const { pushToast } = useToast()

  const [job, setJob] = useState<EmployerJob | null>(null)
  const [applicants, setApplicants] = useState<ScoredApplication[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    applicationId: string
    status: ApplicationStatus
  } | null>(null)

  const loadPage = useCallback(async () => {
    if (!jobId) {
      return
    }

    setIsLoading(true)
    setLoadError(null)
    setInfoMessage(null)

    if (previewMode) {
      const previewJob = getPreviewEmployerJob(jobId)
      if (!previewJob) {
        setLoadError('Job not found.')
        setIsLoading(false)
        return
      }
      setJob(previewJob)
      setApplicants(loadPreviewJobApplicants(jobId))
      setInfoMessage(
        'Preview mode: applicants appear when a candidate applies to this job in the candidate preview.',
      )
      setIsLoading(false)
      return
    }

    try {
      const [jobResult, applicantResult] = await Promise.all([
        jobsApi.get(jobId),
        applicationsApi.listApplicants(jobId),
      ])
      setJob(normalizeEmployerJob({ ...jobResult, applicant_count: applicantResult.length }))
      setApplicants(applicantResult.map(normalizeScoredApplication))
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Could not load applicants. Please try again.'))
    } finally {
      setIsLoading(false)
    }
  }, [jobId, previewMode])

  useEffect(() => {
    void loadPage()
  }, [loadPage])

  const filtered = useMemo(() => {
    if (statusFilter === 'All') {
      return applicants
    }
    return applicants.filter((item) => item.status === statusFilter)
  }, [applicants, statusFilter])

  const summary = useMemo(() => {
    const counts = { Pending: 0, Interviewing: 0, Rejected: 0, Accepted: 0 }
    for (const app of applicants) {
      counts[app.status] += 1
    }
    return counts
  }, [applicants])

  async function applyStatusChange(applicationId: string, status: ApplicationStatus) {
    setStatusError(null)
    setUpdatingId(applicationId)

    try {
      if (previewMode) {
        const updated = updatePreviewApplicantStatus(applicationId, status)
        if (updated) {
          setApplicants((currentList) =>
            currentList.map((item) => (item.id === applicationId ? updated : item)),
          )
        }
      } else {
        await applicationsApi.setStatus(applicationId, status)
        setApplicants((currentList) =>
          currentList.map((item) => (item.id === applicationId ? { ...item, status } : item)),
        )
      }
      if (status === 'Accepted') {
        pushToast('Applicant accepted', 'success')
      } else if (status === 'Rejected') {
        pushToast('Applicant rejected', 'error')
      } else {
        pushToast(`Status updated to ${status}`, 'info')
      }
    } catch (err) {
      setStatusError(apiErrorMessage(err, 'Could not update status. Please try again.'))
    } finally {
      setUpdatingId(null)
    }
  }

  function handleStatusSelect(applicationId: string, status: ApplicationStatus) {
    const current = applicants.find((item) => item.id === applicationId)
    if (!current || current.status === status) {
      return
    }
    if (needsStatusChangeConfirm(current.status, status)) {
      setPendingStatusChange({ applicationId, status })
      return
    }
    void applyStatusChange(applicationId, status)
  }

  if (!jobId) {
    return <Navigate to="/employer" replace />
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingScreen />
      </div>
    )
  }

  if (loadError || !job) {
    return (
      <>
        <p className="rounded-panel border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {loadError ?? 'Job not found.'}
        </p>
        <Link to="/employer" className="mt-4 inline-block text-sm font-medium text-brand underline">
          Back to jobs
        </Link>
      </>
    )
  }

  const pendingApplicant = pendingStatusChange
    ? applicants.find((a) => a.id === pendingStatusChange.applicationId)
    : null

  return (
    <>
      <Link to="/employer" className="text-sm font-medium text-muted hover:text-ink">
        ← Back to jobs
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-ink">Applicants</h1>
      <p className="mt-2 text-sm text-muted">{job.title} — sorted by match score (highest first).</p>

      {applicants.length > 0 && (
        <p className="mt-3 text-sm text-muted">
          {applicants.length} applicant{applicants.length === 1 ? '' : 's'} · {summary.Pending} pending ·{' '}
          {summary.Interviewing} interviewing · {summary.Accepted} accepted · {summary.Rejected} rejected
        </p>
      )}

      {infoMessage && (
        <p className="mt-4 rounded-panel border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {infoMessage}
        </p>
      )}

      {statusError && (
        <p className="mt-4 rounded-panel border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {statusError}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {(['All', ...STATUS_OPTIONS] as StatusFilter[]).map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => setStatusFilter(chip)}
            className={`filter-chip ${statusFilter === chip ? 'filter-chip-active' : ''}`}
          >
            {chip}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-6 rounded-panel border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
          {applicants.length === 0
            ? 'No applicants yet. Share this job so candidates can apply.'
            : 'No applicants in this category.'}
        </p>
      )}

      {filtered.length > 0 && (
        <ul className="mt-6 space-y-3">
          {filtered.map((applicant) => {
            const candidateSkills = applicant.candidate?.skills ?? []
            const required = job.required_skills ?? []
            const missing = missingRequiredSkills(required, candidateSkills)
            const interviewBooked = Boolean(applicant.interview_slot)

            return (
              <li key={applicant.id} className="card-panel p-4 transition hover:shadow-card-hover">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-medium text-ink">
                      {applicant.candidate?.display_name ?? 'Candidate'}
                    </h2>
                    <span
                      className={`mt-2 inline-block rounded-md px-2 py-1 text-xs font-bold ${matchScoreBadgeClass(applicant.match_score)}`}
                    >
                      {applicant.match_score}% match
                    </span>
                  </div>
                  <ApplicationStatusBadge status={applicant.status} interviewBooked={interviewBooked} />
                </div>

                {missing.length > 0 && (
                  <p className="mt-2 text-xs text-muted">
                    Missing: {missing.join(', ')}
                  </p>
                )}

                {/* FP-EMP-3: show all of the candidate's skills; ones the job requires are highlighted. */}
                {candidateSkills.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-2" aria-label="Candidate skills">
                    {candidateSkills.map((skill) => (
                      <li
                        key={skill}
                        className={`rounded-full px-2.5 py-0.5 text-xs ${
                          candidateHasSkill(required, skill)
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {skill}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-muted">No skills listed.</p>
                )}

                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-gray-700">Applied</dt>
                    <dd className="mt-1 text-gray-600">{formatDateTime(applicant.created_at)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-700">Interview</dt>
                    <dd className="mt-1 text-gray-600">{interviewSummary(applicant)}</dd>
                  </div>
                </dl>

                <div className="mt-4">
                  <label htmlFor={`status-${applicant.id}`} className="block text-sm font-medium text-gray-700">
                    Update status
                  </label>
                  <select
                    id={`status-${applicant.id}`}
                    value={applicant.status}
                    disabled={updatingId === applicant.id}
                    onChange={(e) => handleStatusSelect(applicant.id, e.target.value as ApplicationStatus)}
                    className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none disabled:opacity-50"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(pendingStatusChange && pendingApplicant)}
        title="Change applicant status?"
        message={
          pendingStatusChange && pendingApplicant
            ? statusChangeConfirmMessage(
                pendingApplicant.candidate?.display_name ?? 'This applicant',
                pendingApplicant.status,
                pendingStatusChange.status,
              )
            : ''
        }
        onCancel={() => setPendingStatusChange(null)}
        onConfirm={() => {
          if (pendingStatusChange) {
            void applyStatusChange(pendingStatusChange.applicationId, pendingStatusChange.status)
          }
          setPendingStatusChange(null)
        }}
      />
    </>
  )
}

export default EmployerApplicantsPage

import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { applicationsApi, jobsApi } from '../api/endpoints'
import ApplicationStatusBadge from '../components/ApplicationStatusBadge'
import EmployerNav from '../components/EmployerNav'
import PageShell from '../components/layout/PageShell'
import LoadingScreen from '../components/LoadingScreen'
import { useAuth } from '../hooks/useAuth'
import { apiErrorMessage } from '../lib/apiErrorMessage'
import { formatDateTime } from '../lib/formatDateTime'
import { interviewSummary } from '../lib/interviewDisplay'
import { candidateHasSkill } from '../lib/matchScoreStyles'
import { normalizeEmployerJob, normalizeScoredApplication } from '../lib/normalizeApi'
import {
  getPreviewEmployerJob,
  loadPreviewJobApplicants,
  updatePreviewApplicantStatus,
} from '../lib/employerPreview'
import { isPreviewUser } from '../lib/preview'
import type { ApplicationStatus, EmployerJob, ScoredApplication } from '../types'

const STATUS_OPTIONS: ApplicationStatus[] = [
  'Pending',
  'Interviewing',
  'Rejected',
  'Accepted',
]

function EmployerApplicantsPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const { user } = useAuth()
  const previewMode = isPreviewUser(user?.id)

  const [job, setJob] = useState<EmployerJob | null>(null)
  const [applicants, setApplicants] = useState<ScoredApplication[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

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

  async function handleStatusChange(applicationId: string, status: ApplicationStatus) {
    const current = applicants.find((item) => item.id === applicationId)
    if (
      current &&
      (status === 'Rejected' || status === 'Accepted') &&
      !window.confirm(`Set this applicant to ${status}?`)
    ) {
      return
    }

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
    } catch (err) {
      setStatusError(apiErrorMessage(err, 'Could not update status. Please try again.'))
    } finally {
      setUpdatingId(null)
    }
  }

  if (!jobId) {
    return <Navigate to="/employer" replace />
  }

  if (isLoading) {
    return <LoadingScreen />
  }

  if (loadError || !job) {
    return (
      <PageShell nav={<EmployerNav />} width="4xl">
          <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {loadError ?? 'Job not found.'}
          </p>
          <Link to="/employer" className="mt-4 inline-block text-sm font-medium text-gray-900 underline">
            Back to jobs
          </Link>
      </PageShell>
    )
  }

  return (
    <PageShell nav={<EmployerNav />} width="4xl">
        <Link to="/employer" className="text-sm font-medium text-gray-600 hover:text-gray-900">
          ← Back to jobs
        </Link>

        <h1 className="mt-4 text-2xl font-semibold text-gray-900">Applicants</h1>
        <p className="mt-2 text-sm text-gray-600">
          {job.title} — sorted by match score (highest first).
        </p>

        {infoMessage && (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {infoMessage}
          </p>
        )}

        {statusError && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {statusError}
          </p>
        )}

        {applicants.length === 0 && (
          <p className="mt-6 rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-600">
            No applicants yet.
          </p>
        )}

        {applicants.length > 0 && (
          <ul className="mt-6 space-y-3">
            {applicants.map((applicant) => (
              <li
                key={applicant.id}
                className="card-panel p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">
                      {applicant.candidate?.display_name ?? 'Candidate'}
                    </h2>
                    <p className="mt-1 text-sm text-gray-600">{applicant.match_score}% match</p>
                  </div>
                  <ApplicationStatusBadge status={applicant.status} />
                </div>

                {(applicant.candidate?.skills ?? []).length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {(applicant.candidate?.skills ?? []).map((skill) => (
                      <li
                        key={skill}
                        className={`rounded-full px-2.5 py-0.5 text-xs ${
                          candidateHasSkill(job.required_skills ?? [], skill)
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {skill}
                      </li>
                    ))}
                  </ul>
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
                  <label
                    htmlFor={`status-${applicant.id}`}
                    className="block text-sm font-medium text-gray-700"
                  >
                    Update status
                  </label>
                  <select
                    id={`status-${applicant.id}`}
                    value={applicant.status}
                    disabled={updatingId === applicant.id}
                    onChange={(e) =>
                      void handleStatusChange(applicant.id, e.target.value as ApplicationStatus)
                    }
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
            ))}
          </ul>
        )}
    </PageShell>
  )
}

export default EmployerApplicantsPage

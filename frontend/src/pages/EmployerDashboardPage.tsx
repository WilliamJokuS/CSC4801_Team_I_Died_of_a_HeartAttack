import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { jobsApi } from '../api/endpoints'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import LoadingScreen from '../components/LoadingScreen'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { apiErrorMessage, isStaleStateError } from '../lib/apiErrorMessage'
import { normalizeEmployerJob } from '../lib/normalizeApi'
import { deletePreviewEmployerJob, loadPreviewEmployerJobs } from '../lib/employerPreview'
import { isPreviewUser } from '../lib/preview'
import type { EmployerJob } from '../types'

function EmployerDashboardPage() {
  const { user } = useAuth()
  const previewMode = isPreviewUser(user?.id)

  const [jobs, setJobs] = useState<EmployerJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null)
  const [jobPendingDelete, setJobPendingDelete] = useState<EmployerJob | null>(null)
  const { pushToast } = useToast()

  // `silent` refreshes in place after a conflict: no full-page spinner, and actionError is kept.
  const loadJobs = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setIsLoading(true)
      setInfoMessage(null)
      setActionError(null)
    }
    setLoadError(null)

    if (previewMode) {
      setJobs(loadPreviewEmployerJobs())
      setInfoMessage('Preview mode: manage sample job postings stored locally.')
      setIsLoading(false)
      return
    }

    try {
      const result = await jobsApi.listMine()
      setJobs(result.map(normalizeEmployerJob))
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Could not load jobs. Please try again.'))
    } finally {
      setIsLoading(false)
    }
  }, [previewMode])

  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

  function requestDelete(job: EmployerJob) {
    if ((job.applicant_count ?? 0) > 0) {
      setActionError("This job has applicants, so it can't be deleted.")
      return
    }
    setJobPendingDelete(job)
  }

  async function confirmDelete() {
    const job = jobPendingDelete
    if (!job) {
      return
    }
    setJobPendingDelete(null)
    setActionError(null)
    setDeletingJobId(job.id)

    try {
      if (previewMode) {
        deletePreviewEmployerJob(job.id)
        setJobs(loadPreviewEmployerJobs())
      } else {
        await jobsApi.remove(job.id)
        setJobs((current) => current.filter((item) => item.id !== job.id))
      }
      pushToast(`Deleted "${job.title}"`, 'error')
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Could not delete the job. Please try again.'))
      // e.g. 409 JOB_HAS_DEPENDENTS: someone applied after we loaded. Reload so the applicant
      // count and the disabled Delete button match the server.
      if (isStaleStateError(err)) {
        void loadJobs({ silent: true })
      }
    } finally {
      setDeletingJobId(null)
    }
  }

  if (isLoading) {
    return <LoadingScreen />
  }

  return (
    <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Your job postings</h1>
            <p className="mt-2 text-sm text-gray-600">Create jobs, review applicants, and manage listings.</p>
          </div>
          <Link
            to="/employer/jobs/new"
            className="btn-primary"
          >
            Post a job
          </Link>
        </div>

        {infoMessage && (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {infoMessage}
          </p>
        )}

        {loadError && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <p>{loadError}</p>
            <button type="button" onClick={() => void loadJobs()} className="mt-2 font-medium underline">
              Retry
            </button>
          </div>
        )}

        {actionError && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {actionError}
          </p>
        )}

        {!loadError && jobs.length === 0 && (
          <p className="mt-6 rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-600">
            No job postings yet.{' '}
            <Link to="/employer/jobs/new" className="font-medium text-gray-900 underline">
              Post your first job
            </Link>
          </p>
        )}

        {jobs.length > 0 && (
          <ul className="mt-6 space-y-3">
            {jobs.map((job) => (
              <li
                key={job.id}
                className="card-panel p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">{job.title}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-600">{job.description}</p>
                    <p className="mt-2 text-xs text-gray-500">
                      {job.applicant_count} applicant{job.applicant_count === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>

                {(job.tags ?? []).length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {(job.tags ?? []).map((tag) => (
                      <li
                        key={tag}
                        className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-900"
                      >
                        {tag}
                      </li>
                    ))}
                  </ul>
                )}

                {job.required_skills.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {job.required_skills.map((skill) => (
                      <li
                        key={skill}
                        className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700"
                      >
                        {skill}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to={`/employer/jobs/${job.id}/applicants`}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    View applicants
                  </Link>
                  <Link
                    to={`/employer/jobs/${job.id}/edit`}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => requestDelete(job)}
                    disabled={deletingJobId === job.id || (job.applicant_count ?? 0) > 0}
                    title={
                      (job.applicant_count ?? 0) > 0
                        ? 'Remove applicants before deleting this job'
                        : undefined
                    }
                    className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingJobId === job.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      <ConfirmDialog
        open={Boolean(jobPendingDelete)}
        title="Delete job posting?"
        message={
          jobPendingDelete
            ? `Delete "${jobPendingDelete.title}"? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        onCancel={() => setJobPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  )
}

export default EmployerDashboardPage

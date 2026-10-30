import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { applicationsApi } from '../api/endpoints'
import ApplicationStatusBadge from '../components/ApplicationStatusBadge'
import CompanyLogo from '../components/ui/CompanyLogo'
import LoadingScreen from '../components/LoadingScreen'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { apiErrorMessage } from '../lib/apiErrorMessage'
import { normalizeScoredApplication } from '../lib/normalizeApi'
import { formatDateTime } from '../lib/formatDateTime'
import { interviewSummary } from '../lib/interviewDisplay'
import {
  isPreviewUser,
  loadPreviewApplications,
  setPreviewApplicationStatus,
} from '../lib/preview'
import type { ApplicationStatus, ScoredApplication } from '../types'

type StatusFilter = 'All' | ApplicationStatus

function CandidateApplicationsPage() {
  const { user } = useAuth()
  const previewMode = isPreviewUser(user?.id)
  const location = useLocation()
  const navigate = useNavigate()
  const { pushToast } = useToast()
  const bookingSuccess = (location.state as { bookingSuccess?: boolean } | null)?.bookingSuccess

  useEffect(() => {
    if (!bookingSuccess) {
      return
    }
    pushToast('Interview booked successfully.', 'success')
    navigate(location.pathname, { replace: true, state: null })
  }, [bookingSuccess, location.pathname, navigate, pushToast])

  const [applications, setApplications] = useState<ScoredApplication[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  const loadApplications = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    setInfoMessage(null)

    if (previewMode) {
      setApplications(loadPreviewApplications())
      setInfoMessage('Preview mode: applications you submit from the Jobs page appear here.')
      setIsLoading(false)
      return
    }

    try {
      const result = await applicationsApi.listMine()
      setApplications(result.map(normalizeScoredApplication))
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Could not load applications. Please try again.'))
    } finally {
      setIsLoading(false)
    }
  }, [previewMode])

  useEffect(() => {
    void loadApplications()
  }, [loadApplications])

  const filtered = useMemo(() => {
    if (statusFilter === 'All') {
      return applications
    }
    return applications.filter((item) => item.status === statusFilter)
  }, [applications, statusFilter])

  const stats = useMemo(
    () => ({
      total: applications.length,
      pending: applications.filter((a) => a.status === 'Pending').length,
      forward: applications.filter((a) => a.status === 'Interviewing' || a.status === 'Accepted').length,
    }),
    [applications],
  )

  function handlePreviewInterviewing(applicationId: string) {
    setPreviewApplicationStatus(applicationId, 'Interviewing')
    setApplications(loadPreviewApplications())
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingScreen />
      </div>
    )
  }

  return (
    <>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="eyebrow">Stay on top of things</p>
          <h1 className="page-heading">
            My applications<span className="text-[#8ba692]">.</span>
          </h1>
          <p className="page-sub mt-2">Every opportunity, every next step — all in one place.</p>
        </div>
        <Link to="/candidate/jobs" className="btn-primary">
          Explore more roles →
        </Link>
      </div>

      {infoMessage && (
        <p className="mb-4 rounded-panel border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {infoMessage}
        </p>
      )}

      {loadError && (
        <div className="mb-4 rounded-panel border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p>{loadError}</p>
          <button type="button" onClick={() => void loadApplications()} className="mt-2 font-semibold underline">
            Retry
          </button>
        </div>
      )}

      <div className="mb-7 grid gap-4 sm:grid-cols-3">
        <div className="rounded-[15px] border border-line bg-white p-[22px]">
          <small className="text-xs text-[#87968a]">Total applications</small>
          <strong className="mt-2 block font-display text-[29px] font-extrabold tracking-tight">{stats.total}</strong>
          <span className="text-[11px] text-[#6c9c77]">Across all roles</span>
        </div>
        <div className="rounded-[15px] border border-line bg-white p-[22px]">
          <small className="text-xs text-[#87968a]">In review</small>
          <strong className="mt-2 block font-display text-[29px] font-extrabold tracking-tight">{stats.pending}</strong>
          <span className="text-[11px] text-[#6c9c77]">Awaiting an update</span>
        </div>
        <div className="rounded-[15px] border border-line bg-white p-[22px]">
          <small className="text-xs text-[#87968a]">Interviews & offers</small>
          <strong className="mt-2 block font-display text-[29px] font-extrabold tracking-tight">{stats.forward}</strong>
          <span className="text-[11px] text-[#6c9c77]">Moving forward</span>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-extrabold tracking-tight">Application tracker</h2>
          <p className="text-xs text-[#8e9b90]">Status updates come from employers</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(['All', 'Pending', 'Interviewing', 'Accepted', 'Rejected'] as StatusFilter[]).map((chip) => (
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

      <div className="flex flex-col gap-[11px]">
        {filtered.length === 0 ? (
          <div className="rounded-[15px] border border-dashed border-[#dce6dc] bg-white px-5 py-12 text-center text-[#829082]">
            <b className="mb-2 block text-ink-strong">No applications in this category</b>
            <Link to="/candidate/jobs" className="btn-secondary mt-4 inline-block">
              Find jobs
            </Link>
          </div>
        ) : (
          filtered.map((application) => (
            <article
              key={application.id}
              className="flex flex-wrap items-center gap-4 rounded-[14px] border border-line bg-white px-5 py-[18px]"
            >
              <CompanyLogo name={application.job?.company_name ?? 'Co'} />
              <div className="min-w-[55%] flex-1">
                <h3 className="text-sm font-semibold">{application.job?.title ?? 'Unknown job'}</h3>
                <p className="mt-1.5 text-xs text-[#8c998f]">
                  {application.job?.company_name ?? ''} · Applied {formatDateTime(application.created_at)}
                </p>
                <p className="mt-1 text-xs text-[#8c998f]">
                  Interview: {interviewSummary(application)} · {application.match_score}% match
                </p>
              </div>
              <ApplicationStatusBadge
                status={application.status}
                interviewBooked={Boolean(application.interview_slot)}
              />
              <div className="flex flex-wrap gap-2">
                {previewMode && application.status === 'Pending' && (
                  <button
                    type="button"
                    onClick={() => handlePreviewInterviewing(application.id)}
                    className="btn-secondary px-3 py-2 text-xs"
                  >
                    Preview: Interviewing
                  </button>
                )}
                {application.status === 'Interviewing' && !application.interview_slot_id && (
                  <Link
                    to={`/candidate/applications/${application.id}/book`}
                    className="btn-primary px-3 py-2 text-xs"
                  >
                    Book interview →
                  </Link>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </>
  )
}

export default CandidateApplicationsPage

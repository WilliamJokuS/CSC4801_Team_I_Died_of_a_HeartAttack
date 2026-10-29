import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { applicationsApi, jobsApi, profileApi } from '../api/endpoints'
import JobDetailPanel from '../components/jobs/JobDetailPanel'
import CompanyLogo from '../components/ui/CompanyLogo'
import LoadingScreen from '../components/LoadingScreen'
import { IconSearch } from '../components/icons/NavIcons'
import { useAuth } from '../hooks/useAuth'
import { useSavedJobs } from '../hooks/useSavedJobs'
import { useToast } from '../hooks/useToast'
import { apiErrorMessage } from '../lib/apiErrorMessage'
import { normalizeScoredJob } from '../lib/normalizeApi'
import { isPreviewUser, loadPreviewJobs, loadPreviewSkills, savePreviewApplication } from '../lib/preview'
import type { ScoredJob } from '../types'

type QuickFilter = 'All jobs' | 'Best match' | 'Internships' | 'Remote'

function hasTag(job: ScoredJob, label: string): boolean {
  return (job.tags ?? []).some((tag) => tag.toLowerCase() === label.toLowerCase())
}

function CandidateJobsView({ savedOnly = false }: { savedOnly?: boolean }) {
  const { user } = useAuth()
  const { pushToast } = useToast()
  const previewMode = isPreviewUser(user?.id)
  const { isSaved, toggleSave, savedIds } = useSavedJobs(user?.id)

  const [jobs, setJobs] = useState<ScoredJob[]>([])
  const [candidateSkills, setCandidateSkills] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [roleType, setRoleType] = useState('All roles')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('All jobs')
  const [sortMode, setSortMode] = useState<'Best match' | 'Newest'>('Best match')

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isApplying, setIsApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)

  const loadJobList = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    setInfoMessage(null)

    if (previewMode) {
      setJobs(loadPreviewJobs())
      setCandidateSkills(loadPreviewSkills())
      setInfoMessage('Preview mode — add skills on Profile to see match scores update.')
      setIsLoading(false)
      return
    }

    try {
      const [jobList, profile] = await Promise.all([jobsApi.listScored(), profileApi.getCandidate()])
      setJobs(jobList.map(normalizeScoredJob))
      setCandidateSkills(Array.isArray(profile.skills) ? profile.skills : [])
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Could not load jobs. Please try again.'))
    } finally {
      setIsLoading(false)
    }
  }, [previewMode])

  useEffect(() => {
    void loadJobList()
  }, [loadJobList])

  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase()
    const pool = savedOnly ? jobs.filter((job) => isSaved(job.id)) : jobs

    return pool.filter((job) => {
      if (roleType === 'Full-time' && !hasTag(job, 'Full-time')) {
        return false
      }
      if (roleType === 'Internship' && !hasTag(job, 'Internship')) {
        return false
      }
      if (quickFilter === 'Best match' && job.match_score < 67) {
        return false
      }
      if (quickFilter === 'Internships' && !hasTag(job, 'Internship')) {
        return false
      }
      if (quickFilter === 'Remote' && !hasTag(job, 'Remote')) {
        return false
      }
      if (!query) {
        return true
      }
      const haystack = [
        job.title,
        job.company_name,
        job.description,
        ...(job.required_skills ?? []),
        ...(job.tags ?? []),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [jobs, search, roleType, quickFilter, savedOnly, savedIds, isSaved])

  const displayJobs = useMemo(() => {
    if (sortMode === 'Newest') {
      return [...filteredJobs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
    }
    return filteredJobs
  }, [filteredJobs, sortMode])

  const selectedJob = useMemo(() => {
    if (displayJobs.length === 0) {
      return null
    }
    const found = displayJobs.find((j) => j.id === selectedId)
    return found ?? displayJobs[0]
  }, [displayJobs, selectedId])

  useEffect(() => {
    if (displayJobs.length === 0) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !displayJobs.some((j) => j.id === selectedId)) {
      setSelectedId(displayJobs[0].id)
    }
  }, [displayJobs, selectedId])

  async function handleApply(job: ScoredJob) {
    setApplyError(null)
    setIsApplying(true)

    try {
      if (previewMode) {
        savePreviewApplication(job.id)
      } else {
        await applicationsApi.apply(job.id)
      }

      setJobs((current) =>
        current.map((item) => (item.id === job.id ? { ...item, has_applied: true } : item)),
      )
      pushToast(`Applied to ${job.title}`, 'success')
    } catch (err) {
      const message = apiErrorMessage(err, 'Could not apply. Please try again.')
      setApplyError(message)
      pushToast(message, 'error')
    } finally {
      setIsApplying(false)
    }
  }

  function handleToggleSave(jobId: string, title: string) {
    const nowSaved = toggleSave(jobId)
    pushToast(nowSaved ? `Saved ${title}` : 'Removed from saved jobs', 'success')
  }

  function clearFilters() {
    setSearch('')
    setRoleType('All roles')
    setQuickFilter('All jobs')
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="eyebrow">{savedOnly ? 'Your shortlist' : 'Discover opportunities'}</p>
          <h1 className="page-heading">{savedOnly ? 'Saved jobs' : 'Find your next role'}</h1>
          <p className="page-sub mt-2">
            {savedOnly
              ? 'Jobs you’ve bookmarked for later.'
              : 'Browse opportunities and find a good fit for your skills.'}
          </p>
        </div>
        <span className="rounded-full border border-line px-[11px] py-[7px] text-xs text-[#66748c]">
          {displayJobs.length} {displayJobs.length === 1 ? 'role' : 'roles'}
        </span>
      </div>

      {infoMessage && (
        <p className="mb-4 rounded-panel border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {infoMessage}
        </p>
      )}

      {loadError && (
        <div className="mb-4 rounded-panel border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p>{loadError}</p>
          <button type="button" onClick={() => void loadJobList()} className="mt-2 font-semibold underline">
            Retry
          </button>
        </div>
      )}

      <div className="grid items-start gap-[19px] lg:grid-cols-[440px_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="card-panel mb-3 grid gap-3 p-[19px]">
            <label className="relative block">
              <IconSearch className="pointer-events-none absolute left-3.5 top-3 text-xl text-[#8493ac]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search roles, companies, skills..."
                className="input-field w-full py-3 pl-10 pr-3"
                aria-label="Search jobs"
              />
            </label>
            <div className="flex gap-2">
              <select
                value={roleType}
                onChange={(e) => setRoleType(e.target.value)}
                className="input-field min-w-0 flex-1 py-3"
                aria-label="Employment type"
              >
                {['All roles', 'Full-time', 'Internship'].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as 'Best match' | 'Newest')}
                className="input-field min-w-0 flex-1 py-3"
                aria-label="Sort"
              >
                <option>Best match</option>
                <option>Newest</option>
              </select>
            </div>
            {!savedOnly && (
              <div className="flex flex-wrap gap-2">
                {(['All jobs', 'Best match', 'Internships', 'Remote'] as QuickFilter[]).map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setQuickFilter(chip)}
                    className={`filter-chip ${quickFilter === chip ? 'filter-chip-active' : ''}`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mb-3 flex justify-between px-1 text-sm">
            <b>{displayJobs.length} results</b>
            <span className="text-muted">Select a job to see details</span>
          </div>

          <div className="grid max-h-[calc(100vh-285px)] gap-2.5 overflow-auto pr-1">
            {!loadError && displayJobs.length === 0 ? (
              <div className="card-panel py-12 text-center text-muted">
                <b className="mb-2 block text-ink">
                  {savedOnly ? 'No saved jobs yet' : jobs.length === 0 ? 'No jobs posted yet' : 'No matching roles yet'}
                </b>
                <span className="text-sm">
                  {savedOnly ? (
                    <>
                      Bookmark roles from{' '}
                      <Link to="/candidate/jobs" className="font-bold text-brand">
                        Find jobs
                      </Link>
                      .
                    </>
                  ) : (
                    'Try changing your filters or search query.'
                  )}
                </span>
                {!savedOnly && jobs.length > 0 && (
                  <button type="button" onClick={clearFilters} className="btn-secondary mt-4">
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              displayJobs.map((job) => {
                const selected = selectedJob?.id === job.id
                return (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(job.id)
                      setApplyError(null)
                    }}
                    className={`block w-full rounded-[14px] border bg-white p-[19px] text-left transition ${
                      selected
                        ? 'border-[#9ab8ff] shadow-[0_0_0_2px_#e9f0ff]'
                        : 'border-line hover:border-[#b4c8f6] hover:bg-[#fcfdff]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <CompanyLogo name={job.company_name} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-bold tracking-tight">{job.title}</div>
                        <div className="mt-1.5 text-xs text-muted">
                          {job.company_name}
                          {(job.tags ?? [])[0] ? ` · ${(job.tags ?? [])[0]}` : ''}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-[7px] bg-[#edf3ff] px-2 py-1.5 text-[11px] font-bold text-[#295fc8]">
                        {job.match_score}%
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {(job.tags ?? []).slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded-md bg-[#f3f5f8] px-2 py-1.5 text-[11px] text-[#5a667a]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <JobDetailPanel
          job={selectedJob}
          candidateSkills={candidateSkills}
          isApplying={isApplying}
          applyError={applyError}
          isSaved={selectedJob ? isSaved(selectedJob.id) : false}
          onApply={() => selectedJob && void handleApply(selectedJob)}
          onToggleSave={() =>
            selectedJob && handleToggleSave(selectedJob.id, selectedJob.title)
          }
        />
      </div>
    </>
  )
}

export default CandidateJobsView

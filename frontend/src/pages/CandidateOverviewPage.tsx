import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { applicationsApi, jobsApi, profileApi } from '../api/endpoints'
import ApplicationStatusBadge from '../components/ApplicationStatusBadge'
import CompanyLogo from '../components/ui/CompanyLogo'
import LoadingScreen from '../components/LoadingScreen'
import { useAuth } from '../hooks/useAuth'
import { useSavedJobs } from '../hooks/useSavedJobs'
import { apiErrorMessage } from '../lib/apiErrorMessage'
import { initialsFromDisplayName } from '../lib/companyLogoStyle'
import { normalizeScoredApplication, normalizeScoredJob } from '../lib/normalizeApi'
import { isPreviewUser, loadPreviewApplications, loadPreviewJobs, loadPreviewSkills } from '../lib/preview'
import type { ScoredApplication, ScoredJob } from '../types'

function CandidateOverviewPage() {
  const { user } = useAuth()
  const previewMode = isPreviewUser(user?.id)
  const { savedCount } = useSavedJobs(user?.id)

  const [jobs, setJobs] = useState<ScoredJob[]>([])
  const [applications, setApplications] = useState<ScoredApplication[]>([])
  const [skills, setSkills] = useState<string[]>([])
  const [displayName, setDisplayName] = useState(user?.display_name ?? 'Candidate')
  const [locationLabel, setLocationLabel] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    if (previewMode) {
      setJobs(loadPreviewJobs())
      setApplications(loadPreviewApplications())
      setSkills(loadPreviewSkills())
      setDisplayName(user?.display_name ?? 'Alice Tan')
      setLocationLabel('Hong Kong')
      setIsLoading(false)
      return
    }

    try {
      const [jobList, apps, profile] = await Promise.all([
        jobsApi.listScored(),
        applicationsApi.listMine(),
        profileApi.getCandidate(),
      ])
      setJobs(jobList.map(normalizeScoredJob))
      setApplications(apps.map(normalizeScoredApplication))
      setSkills(Array.isArray(profile.skills) ? profile.skills : [])
      setDisplayName(profile.display_name ?? user?.display_name ?? 'Candidate')
      setLocationLabel('')
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Could not load your dashboard.'))
    } finally {
      setIsLoading(false)
    }
  }, [previewMode, user?.display_name, user?.id])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(
    () => ({
      applications: applications.length,
      saved: savedCount,
      interviews: applications.filter((a) => a.status === 'Interviewing').length,
      inProgress: applications.filter((a) => a.status === 'Pending').length,
    }),
    [applications, savedCount],
  )

  const recommended = jobs.slice(0, 3)
  const recentApps = applications.slice(0, 3)
  const firstName = displayName.split(/\s+/)[0] || displayName

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
          <p className="eyebrow">Candidate workspace</p>
          <h1 className="page-heading">Good to see you, {firstName}.</h1>
          <p className="page-sub mt-2">Here’s what’s happening with your job search.</p>
        </div>
        <Link to="/candidate/jobs" className="btn-primary">
          Explore jobs →
        </Link>
      </div>

      {loadError && (
        <div className="mb-4 rounded-panel border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p>{loadError}</p>
          <button type="button" onClick={() => void load()} className="mt-2 font-semibold underline">
            Retry
          </button>
        </div>
      )}

      <div className="mb-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-h-[230px] rounded-[19px] bg-gradient-to-br from-[#182b55] to-[#356de8] p-8 text-white">
          <span className="text-xs text-[#bfd1fc]">YOUR NEXT OPPORTUNITY</span>
          <h2 className="mt-3 text-[28px] font-bold leading-tight tracking-[-0.8px]">
            Find roles built around your strengths.
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-[#dbe5ff]">
            Explore openings recommended from your skills and interests.
          </p>
          <Link to="/candidate/jobs" className="mt-5 inline-flex rounded-[10px] bg-white px-4 py-2.5 text-sm font-semibold text-ink">
            Browse matching jobs →
          </Link>
        </div>

        <div className="card-panel">
          <h3 className="text-base font-bold">Application activity</h3>
          {recentApps.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No applications yet.</p>
          ) : (
            <ul className="mt-2">
              {recentApps.map((app) => (
                <li key={app.id} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
                  <CompanyLogo name={app.job.company_name} size="md" />
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-sm">{app.job.title}</b>
                    <span className="text-xs text-muted">{app.job.company_name}</span>
                  </div>
                  <ApplicationStatusBadge status={app.status} />
                </li>
              ))}
            </ul>
          )}
          <Link to="/candidate/applications" className="mt-3 inline-block text-sm font-bold text-brand">
            View all applications →
          </Link>
        </div>
      </div>

      <div className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: 'Applications', value: stats.applications, sub: 'Roles you have applied to' },
          { label: 'Saved jobs', value: stats.saved, sub: 'On your shortlist' },
          { label: 'Interviews', value: stats.interviews, sub: 'Applications in interview' },
        ].map((item) => (
          <div key={item.label} className="card-panel">
            <span className="text-xs font-semibold text-muted">{item.label}</span>
            <strong className="mt-2 block text-[28px] font-bold tracking-tight">{item.value}</strong>
            <span className="text-xs text-muted">{item.sub}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="card-panel">
          <h3 className="text-[17px] font-bold">Recommended roles</h3>
          {recommended.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No jobs posted yet.</p>
          ) : (
            recommended.map((job) => (
              <div key={job.id} className="flex items-center gap-3 border-t border-line py-3.5 first:border-t-0">
                <CompanyLogo name={job.company_name} size="md" />
                <div className="min-w-0 flex-1">
                  <b className="block text-sm">{job.title}</b>
                  <span className="text-xs text-muted">
                    {job.company_name}
                    {(job.tags ?? [])[0] ? ` · ${(job.tags ?? [])[0]}` : ''}
                  </span>
                </div>
                <span className="rounded-[7px] bg-[#edf3ff] px-2 py-1.5 text-[11px] font-bold text-[#295fc8]">
                  {job.match_score}% match
                </span>
                <Link to="/candidate/jobs" className="btn-secondary px-3 py-2 text-xs">
                  View
                </Link>
              </div>
            ))
          )}
        </section>

        <section className="card-panel">
          <h3 className="text-[17px] font-bold">Your profile</h3>
          <div className="mt-4 flex items-center gap-3">
            <span className="grid h-[58px] w-[58px] place-items-center rounded-[14px] bg-[#e4ecff] text-lg font-bold text-[#3159b3]">
              {initialsFromDisplayName(displayName)}
            </span>
            <div>
              <b className="block">{displayName}</b>
              {locationLabel && <p className="text-xs text-muted">{locationLabel}</p>}
            </div>
          </div>
          <p className="mt-5 text-sm leading-relaxed text-muted">
            Keep your skills updated to get more useful job matches.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {skills.slice(0, 5).map((skill) => (
              <span key={skill} className="rounded-lg bg-[#edf3ff] px-[11px] py-[7px] text-xs text-[#315dba]">
                {skill}
              </span>
            ))}
          </div>
          <Link to="/candidate/profile" className="btn-secondary mt-6 inline-block text-xs">
            Edit profile →
          </Link>
        </section>
      </div>
    </>
  )
}

export default CandidateOverviewPage

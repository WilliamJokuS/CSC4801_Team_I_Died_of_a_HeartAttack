import type { ScoredJob } from '../../types'
import { candidateHasSkill } from '../../lib/matchScoreStyles'
import CompanyLogo from '../ui/CompanyLogo'

interface JobDetailPanelProps {
  job: ScoredJob | null
  candidateSkills: string[]
  isApplying: boolean
  applyError: string | null
  isSaved: boolean
  onApply: () => void
  onToggleSave: () => void
}

function JobDetailPanel({
  job,
  candidateSkills,
  isApplying,
  applyError,
  isSaved,
  onApply,
  onToggleSave,
}: JobDetailPanelProps) {
  if (!job) {
    return (
      <div className="card-panel flex min-h-[580px] items-center justify-center text-muted">
        Select a role to view details.
      </div>
    )
  }

  const locationTag = (job.tags ?? []).find((t) => /hong kong|shenzhen|remote/i.test(t)) ?? job.tags?.[0]

  return (
    <article className="sticky top-[96px] min-h-[580px] overflow-hidden rounded-panel border border-line bg-white">
      <div className="border-b border-line px-[30px] pb-6 pt-7">
        <div className="flex items-center gap-3.5">
          <CompanyLogo name={job.company_name} size="lg" />
          <div>
            <b className="text-sm">{job.company_name}</b>
            <div className="mt-1.5 text-xs text-muted">
              {[locationTag, ...(job.tags ?? []).filter((t) => /hybrid|remote|on-site/i.test(t))].filter(Boolean).join(' · ') ||
                'See tags below'}
            </div>
          </div>
        </div>
        <h2 className="mt-[22px] text-[27px] font-bold leading-[1.18] tracking-[-0.8px]">{job.title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <span className="rounded-[7px] bg-[#edf3ff] px-2.5 py-1.5 text-[11px] font-bold text-[#295fc8]">
            {job.match_score}% skill match
          </span>
        </div>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={onApply}
            disabled={job.has_applied || isApplying}
            className="btn-primary disabled:opacity-50"
          >
            {job.has_applied ? 'Already applied' : isApplying ? 'Applying…' : 'Apply for this role →'}
          </button>
          <button type="button" onClick={onToggleSave} className="btn-secondary">
            {isSaved ? '♥ Saved' : '♡ Save job'}
          </button>
        </div>
        {applyError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{applyError}</p>}
      </div>

      <div className="max-h-[calc(100vh-380px)] overflow-auto px-[30px] pb-8 pt-6">
        <h3 className="text-[15px] font-bold tracking-[-0.25px]">About this role</h3>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-[1.8] text-[#66748a]">{job.description}</p>

        {job.company_description && (
          <>
            <h3 className="mt-6 text-[15px] font-bold tracking-[-0.25px]">About the company</h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-[1.8] text-[#66748a]">{job.company_description}</p>
          </>
        )}

        <h3 className="mt-6 text-[15px] font-bold tracking-[-0.25px]">Skills for this role</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {(job.required_skills ?? []).length === 0 ? (
            <p className="text-sm text-[#66748a]">No required skills listed.</p>
          ) : (
            (job.required_skills ?? []).map((skill) => (
              <span
                key={skill}
                className={`rounded-lg px-[11px] py-[7px] text-xs ${
                  candidateHasSkill(candidateSkills, skill)
                    ? 'bg-[#edf3ff] text-[#315dba]'
                    : 'bg-[#f3f5f8] text-[#5a667a]'
                }`}
              >
                {skill}
              </span>
            ))
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-[18px]">
          <div>
            <div className="mb-2 text-xs text-muted">Employment type</div>
            <div className="text-sm font-bold">
              {(job.tags ?? []).find((t) => /full-time|internship|part-time|graduate/i.test(t)) ?? '—'}
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs text-muted">Work arrangement</div>
            <div className="text-sm font-bold">
              {(job.tags ?? []).find((t) => /hybrid|remote|on-site/i.test(t)) ?? '—'}
            </div>
          </div>
        </div>

        <h3 className="mt-6 text-[15px] font-bold tracking-[-0.25px]">How your skills compare</h3>
        <p className="mt-3 text-sm leading-[1.8] text-[#66748a]">
          Based on the skills in your profile, this position has a {job.match_score}% indicative match score from the
          platform.
        </p>
      </div>
    </article>
  )
}

export default JobDetailPanel

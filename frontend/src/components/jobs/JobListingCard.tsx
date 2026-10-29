import type { ScoredJob } from '../../types'
import { candidateHasSkill } from '../../lib/matchScoreStyles'
import CompanyLogo from '../ui/CompanyLogo'
import { IconBookmark } from '../icons/NavIcons'

interface JobListingCardProps {
  job: ScoredJob
  candidateSkills: string[]
  isApplying: boolean
  isSaved: boolean
  onViewDetails: () => void
  onApply: () => void
  onToggleSave: () => void
}

function JobListingCard({
  job,
  candidateSkills,
  isApplying,
  isSaved,
  onViewDetails,
  onApply,
  onToggleSave,
}: JobListingCardProps) {
  const requiredSkills = job.required_skills ?? []
  const skills = candidateSkills ?? []

  return (
    <article className="rounded-2xl border border-line bg-white p-6 shadow-card transition hover:-translate-y-px hover:border-[#bdd6c0] hover:shadow-card-hover">
      <div className="flex items-start gap-3.5">
        <CompanyLogo name={job.company_name} />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[17px] font-extrabold tracking-tight">
            <button type="button" onClick={onViewDetails} className="text-left hover:text-brand">
              {job.title}
            </button>
          </h3>
          <p className="mt-1 text-xs text-[#839087]">{job.company_name}</p>
        </div>
        <button
          type="button"
          onClick={onToggleSave}
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-[9px] border ${
            isSaved ? 'border-[#cbdcca] bg-[#e9f2e8] text-brand' : 'border-[#e7ebe6] text-[#9aa69d]'
          }`}
          aria-label={isSaved ? 'Remove saved job' : 'Save job'}
        >
          <IconBookmark />
        </button>
      </div>

      <p className="mt-4 line-clamp-3 text-[13px] leading-relaxed text-[#7a887d]">{job.description}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {(job.tags ?? []).map((tag) => (
          <span key={tag} className="rounded-md bg-[#f3f6f2] px-2.5 py-1.5 text-[11px] font-semibold text-[#748176]">
            {tag}
          </span>
        ))}
        {requiredSkills.map((skill) => (
          <span
            key={skill}
            className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold ${
              candidateHasSkill(skills, skill)
                ? 'bg-[#edf5ec] text-[#4c8062]'
                : 'bg-[#f3f6f2] text-[#748176]'
            }`}
          >
            {skill}
          </span>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#eff1ed] pt-4">
        <span className="rounded-[30px] bg-[#e8f4e8] px-2.5 py-1.5 text-[11px] font-extrabold text-[#31744e]">
          ✦ {job.match_score}% match
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onViewDetails} className="btn-secondary px-3 py-2 text-xs">
            View role →
          </button>
          {job.has_applied ? (
            <span className="rounded-[10px] bg-[#e9f2e8] px-3 py-2 text-xs font-bold text-brand">Applied</span>
          ) : (
            <button
              type="button"
              onClick={onApply}
              disabled={isApplying}
              className="btn-primary px-3 py-2 text-xs disabled:opacity-50"
            >
              {isApplying ? 'Applying…' : 'Quick apply'}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

export default JobListingCard

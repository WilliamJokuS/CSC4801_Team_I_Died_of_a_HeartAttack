import { useEffect } from 'react'
import type { ScoredJob } from '../types'
import { candidateHasSkill } from '../lib/matchScoreStyles'
import CompanyLogo from './ui/CompanyLogo'
import { IconBookmark } from './icons/NavIcons'

interface JobDetailDialogProps {
  job: ScoredJob
  candidateSkills: string[]
  isApplying: boolean
  applyError: string | null
  isSaved: boolean
  onClose: () => void
  onApply: () => void
  onToggleSave: () => void
}

function JobDetailDialog({
  job,
  candidateSkills,
  isApplying,
  applyError,
  isSaved,
  onClose,
  onApply,
  onToggleSave,
}: JobDetailDialogProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(23,35,28,0.36)] p-5 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-[590px] overflow-y-auto rounded-[22px] bg-white p-[30px] shadow-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-detail-title"
      >
        <div className="flex items-start justify-between gap-3">
          <CompanyLogo name={job.company_name} size="lg" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-[#f2f5f2] text-xl text-[#6c7a6d]"
          >
            ×
          </button>
        </div>

        <h2 id="job-detail-title" className="mt-4 font-display text-[25px] font-extrabold tracking-tight">
          {job.title}
        </h2>
        <p className="mt-1 text-xs text-[#839087]">{job.company_name}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          {(job.tags ?? []).map((tag) => (
            <span key={tag} className="rounded-md bg-[#f3f6f2] px-2.5 py-1.5 text-[11px] font-semibold text-[#748176]">
              {tag}
            </span>
          ))}
          <span className="rounded-[30px] bg-[#e8f4e8] px-2.5 py-1.5 text-[11px] font-extrabold text-[#31744e]">
            ✦ {job.match_score}% skill match
          </span>
        </div>

        <h4 className="mt-6 text-sm font-bold text-ink">About the opportunity</h4>
        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[#748379]">{job.description}</p>

        {job.company_description && (
          <>
            <h4 className="mt-6 text-sm font-bold text-ink">About the company</h4>
            <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[#748379]">
              {job.company_description}
            </p>
          </>
        )}

        <h4 className="mt-6 text-sm font-bold text-ink">Skills we&apos;re looking for</h4>
        <div className="mt-3 flex flex-wrap gap-2">
          {(job.required_skills ?? []).length === 0 ? (
            <p className="text-[13px] text-[#748379]">No required skills listed.</p>
          ) : (
            (job.required_skills ?? []).map((skill) => (
              <span
                key={skill}
                className={`rounded-[20px] px-3 py-2 text-xs font-bold ${
                  candidateHasSkill(candidateSkills ?? [], skill)
                    ? 'bg-[#ecf4ed] text-[#387151]'
                    : 'bg-[#f3f6f2] text-[#748176]'
                }`}
              >
                {skill}
              </span>
            ))
          )}
        </div>

        {applyError && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{applyError}</p>}

        <div className="mt-6 flex flex-wrap gap-2.5">
          <button type="button" onClick={onToggleSave} className="btn-secondary inline-flex items-center gap-2">
            <IconBookmark className="h-4 w-4" />
            {isSaved ? 'Remove bookmark' : 'Save this role'}
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={job.has_applied || isApplying}
            className="btn-primary disabled:opacity-50"
          >
            {job.has_applied ? 'Already applied' : isApplying ? 'Applying…' : 'Apply now →'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default JobDetailDialog

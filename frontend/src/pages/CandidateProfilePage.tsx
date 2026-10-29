import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { profileApi } from '../api/endpoints'
import LoadingScreen from '../components/LoadingScreen'
import SkillsField from '../components/SkillsField'
import { useAuth } from '../hooks/useAuth'
import { apiErrorMessage } from '../lib/apiErrorMessage'
import { initialsFromDisplayName } from '../lib/companyLogoStyle'
import { isPreviewUser, PREVIEW_PROFILE_KEY } from '../lib/preview'

function emptyProfile(displayName: string) {
  return {
    display_name: displayName,
    skills: [] as string[],
    resume_text: '',
  }
}

function loadPreviewProfile(displayName: string) {
  const stored = localStorage.getItem(PREVIEW_PROFILE_KEY)
  if (!stored) {
    return emptyProfile(displayName)
  }
  try {
    const parsed = JSON.parse(stored) as {
      display_name: string
      skills: string[]
      resume_text: string
    }
    return {
      display_name: parsed.display_name ?? displayName,
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      resume_text: parsed.resume_text ?? '',
    }
  } catch {
    return emptyProfile(displayName)
  }
}

function savePreviewProfile(profile: {
  display_name: string
  skills: string[]
  resume_text: string
}) {
  localStorage.setItem(PREVIEW_PROFILE_KEY, JSON.stringify(profile))
}

const RESUME_MAX = 20_000

function CandidateProfilePage() {
  const { user } = useAuth()
  const previewMode = isPreviewUser(user?.id)

  const [displayName, setDisplayName] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [resumeText, setResumeText] = useState('')

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loadWarning, setLoadWarning] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      setIsLoading(true)
      setError(null)
      setLoadWarning(null)

      if (previewMode) {
        const preview = loadPreviewProfile(user?.display_name ?? '')
        if (!cancelled) {
          setDisplayName(preview.display_name)
          setSkills(preview.skills)
          setResumeText(preview.resume_text)
          setLoadWarning('Preview mode: profile is stored locally in this browser.')
          setIsLoading(false)
        }
        return
      }

      try {
        const profile = await profileApi.getCandidate()
        if (!cancelled) {
          setDisplayName(profile.display_name)
          setSkills(Array.isArray(profile.skills) ? profile.skills : [])
          setResumeText(profile.resume_text)
        }
      } catch (err) {
        if (!cancelled) {
          setDisplayName(user?.display_name ?? '')
          setSkills([])
          setResumeText('')
          setLoadWarning(`Could not load profile (${apiErrorMessage(err)}). You can still edit and save.`)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadProfile()
    return () => {
      cancelled = true
    }
  }, [previewMode, user?.display_name])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (resumeText.length > RESUME_MAX) {
      setError(`Resume must be at most ${RESUME_MAX.toLocaleString()} characters.`)
      return
    }

    setIsSaving(true)

    const payload = {
      display_name: displayName.trim(),
      skills,
      resume_text: resumeText,
    }

    try {
      if (previewMode) {
        savePreviewProfile(payload)
        setSuccess('Profile saved locally (preview mode).')
      } else {
        const updated = await profileApi.updateCandidate(payload)
        setDisplayName(updated.display_name)
        setSkills(updated.skills)
        setResumeText(updated.resume_text)
        setSuccess('Profile saved.')
      }
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
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
          <p className="eyebrow">Make a great first impression</p>
          <h1 className="page-heading">Your profile & résumé.</h1>
          <p className="page-sub mt-2">A little more about you helps make every match more meaningful.</p>
        </div>
        <button type="submit" form="profile-form" disabled={isSaving} className="btn-primary">
          {isSaving ? 'Saving…' : 'Save changes →'}
        </button>
      </div>

      {loadWarning && (
        <p className="mb-4 rounded-panel border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {loadWarning}
        </p>
      )}

      <div className="mb-6 flex items-center gap-[18px]">
        <div className="grid h-[66px] w-[66px] place-items-center rounded-[20px] bg-[#e9f0e4] text-2xl font-extrabold text-[#49724f]">
          {initialsFromDisplayName(displayName || 'You')}
        </div>
        <div>
          <h2 className="font-display text-[21px] font-extrabold">{displayName || 'Your name'}</h2>
          <p className="text-xs text-[#87968a]">{user?.email}</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(250px,0.85fr)]">
        <form id="profile-form" className="rounded-panel border border-line bg-white p-[27px] shadow-card" onSubmit={handleSubmit}>
          <h3 className="font-display text-[17px] font-extrabold">Personal details</h3>

          <div className="mt-[17px] grid gap-[17px] sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-xs font-bold text-[#5d6e62]">
              Display name
              <input
                id="display_name"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input-field rounded-[9px] px-[13px] py-3"
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-bold text-[#5d6e62] sm:col-span-2">
              Skills (used for match scores)
              <SkillsField
                skills={skills}
                onChange={setSkills}
                inputId="profile_skills"
                label=""
                hint="Press Enter to add each skill."
              />
            </label>
          </div>

          {skills.length > 0 && (
            <div className="my-4 flex flex-wrap gap-2">
              {skills.map((skill) => (
                <span key={skill} className="rounded-[20px] bg-[#ecf4ed] px-3 py-2 text-xs font-bold text-[#387151]">
                  {skill}
                </span>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-700">{success}</p>}

          <button type="submit" disabled={isSaving} className="btn-primary mt-4">
            {isSaving ? 'Saving…' : 'Save profile changes'}
          </button>
        </form>

        <div className="space-y-5">
          <div className="rounded-panel border border-line bg-white p-[27px] shadow-card">
            <h3 className="font-display text-[17px] font-extrabold">Your résumé</h3>
            <p className="mt-2 text-xs text-[#8f9b91]">Private to you — employers never see this text.</p>
            <div className="mt-4 rounded-xl border border-dashed border-[#bbd3bf] bg-[#fbfdfa] p-6 text-center">
              <div className="mb-2 text-[29px]">↥</div>
              <strong className="block">Paste your résumé</strong>
              <p className="mb-4 text-xs text-[#8f9b91]">Plain text up to {RESUME_MAX.toLocaleString()} characters.</p>
              <textarea
                id="resume_text"
                rows={8}
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste or type your resume here…"
                className="input-field min-h-[100px] w-full resize-y rounded-[9px] text-left text-sm"
              />
              <p className="mt-2 text-xs text-[#8f9b91]">
                {resumeText.length.toLocaleString()} / {RESUME_MAX.toLocaleString()} characters
              </p>
            </div>
          </div>

          <div className="rounded-panel border border-line bg-white p-[27px] shadow-card">
            <p className="eyebrow">A little tip</p>
            <h3 className="font-display text-base font-extrabold">Let your skills do the talking.</h3>
            <p className="page-sub mt-2">
              Match scores compare your saved skills with each role&apos;s requirements.
            </p>
            <Link to="/candidate/jobs" className="btn-secondary mt-4 inline-block">
              See matching jobs →
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}

export default CandidateProfilePage

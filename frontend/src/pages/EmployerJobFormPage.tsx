import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { jobsApi } from '../api/endpoints'
import LoadingScreen from '../components/LoadingScreen'
import SkillsField from '../components/SkillsField'
import TagsField from '../components/TagsField'
import { ApiError } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { apiErrorMessage } from '../lib/apiErrorMessage'
import { hasPendingText, stringArraysEqual } from '../lib/formChange'
import { LIMITS } from '../lib/formLimits'
import {
  createPreviewEmployerJob,
  getPreviewEmployerJob,
  updatePreviewEmployerJob,
} from '../lib/employerPreview'
import { normalizeJob } from '../lib/normalizeApi'
import { isPreviewUser } from '../lib/preview'

function EmployerJobFormPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const previewMode = isPreviewUser(user?.id)
  const isCreateRoute = location.pathname.endsWith('/jobs/new')
  const isEdit = Boolean(jobId) && !isCreateRoute

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [requiredSkills, setRequiredSkills] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [savedSnapshot, setSavedSnapshot] = useState({
    title: '',
    description: '',
    requiredSkills: [] as string[],
    tags: [] as string[],
  })

  const [isLoading, setIsLoading] = useState(isEdit)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    if (!isEdit || !jobId) {
      return
    }

    let cancelled = false

    async function loadJob() {
      setIsLoading(true)
      setError(null)
      setNotFound(false)
      setForbidden(false)
      setLoadFailed(false)

      if (previewMode) {
        const job = getPreviewEmployerJob(jobId!)
        if (!cancelled) {
          if (!job) {
            setNotFound(true)
          } else {
            const snap = {
              title: job.title,
              description: job.description,
              requiredSkills: job.required_skills ?? [],
              tags: job.tags ?? [],
            }
            setSavedSnapshot(snap)
            setTitle(snap.title)
            setDescription(snap.description)
            setRequiredSkills(snap.requiredSkills)
            setTags(snap.tags)
          }
          setIsLoading(false)
        }
        return
      }

      try {
        const job = normalizeJob(await jobsApi.get(jobId!))
        if (cancelled) {
          return
        }
        if (job.employer_id !== user?.id) {
          setForbidden(true)
          return
        }
        const snap = {
          title: job.title,
          description: job.description,
          requiredSkills: job.required_skills,
          tags: job.tags ?? [],
        }
        setSavedSnapshot(snap)
        setTitle(snap.title)
        setDescription(snap.description)
        setRequiredSkills(snap.requiredSkills)
        setTags(snap.tags)
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError && err.status === 404) {
            setNotFound(true)
          } else {
            setLoadFailed(true)
            setError(apiErrorMessage(err, 'Could not load this job.'))
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadJob()
    return () => {
      cancelled = true
    }
  }, [isEdit, jobId, previewMode, user?.id])

  const isDirty = useMemo(() => {
    if (!isEdit) {
      return (
        title.trim().length > 0 ||
        description.trim().length > 0 ||
        requiredSkills.length > 0 ||
        tags.length > 0
      )
    }
    return (
      title.trim() !== savedSnapshot.title.trim() ||
      description.trim() !== savedSnapshot.description.trim() ||
      !stringArraysEqual(requiredSkills, savedSnapshot.requiredSkills) ||
      tags.length !== savedSnapshot.tags.length ||
      tags.some((tag, index) => tag.trim() !== savedSnapshot.tags[index].trim())
    )
  }, [description, isEdit, requiredSkills, savedSnapshot, tags, title])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (hasPendingText(event.currentTarget, 'job_skills') || hasPendingText(event.currentTarget, 'job_tags')) {
      setError('Add or clear the typed skills or tags before saving.')
      return
    }
    setError(null)
    setIsSaving(true)

    const payload = {
      title: title.trim(),
      description: description.trim(),
      required_skills: requiredSkills,
      tags,
    }

    try {
      if (previewMode) {
        if (isEdit && jobId) {
          updatePreviewEmployerJob(jobId, payload)
        } else {
          createPreviewEmployerJob(payload)
        }
      } else if (isEdit && jobId) {
        await jobsApi.update(jobId, payload)
      } else {
        await jobsApi.create(payload)
      }
      navigate('/employer', { replace: true })
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

  if (notFound) {
    return (
      <>
        <p className="rounded-panel border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Job not found.
        </p>
        <Link to="/employer" className="mt-4 inline-block text-sm font-medium text-brand underline">
          Back to jobs
        </Link>
      </>
    )
  }

  if (forbidden) {
    return (
      <>
        <p className="rounded-panel border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          You can&apos;t edit this job — it belongs to another employer.
        </p>
        <Link to="/employer" className="mt-4 inline-block text-sm font-medium text-brand underline">
          Back to your jobs
        </Link>
      </>
    )
  }

  if (loadFailed) {
    return (
      <>
        <p className="rounded-panel border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        <button type="button" onClick={() => window.location.reload()} className="btn-secondary mt-4">
          Retry
        </button>
      </>
    )
  }

  return (
    <>
      <Link to="/employer" className="text-sm font-medium text-muted hover:text-ink">
        ← Back to jobs
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-ink">
        {isEdit ? 'Edit job posting' : 'Post a new job'}
      </h1>
      <p className="mt-2 text-sm text-muted">
        Saving always sends the full job, including tags, so nothing is cleared by accident.
      </p>

      <form className="card-panel mt-6 space-y-6" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            Job title
          </label>
          <input
            id="title"
            type="text"
            required
            maxLength={LIMITS.jobTitleMaxLength}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input-field mt-1 py-2"
          />
          <p className="mt-1 text-xs text-muted">
            {title.length} / {LIMITS.jobTitleMaxLength} characters
          </p>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            id="description"
            required
            rows={8}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input-field mt-1 py-2"
          />
        </div>

        <SkillsField skills={requiredSkills} onChange={setRequiredSkills} inputId="job_skills" />
        <TagsField tags={tags} onChange={setTags} inputId="job_tags" />

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={isSaving || !isDirty} className="btn-primary disabled:opacity-50">
            {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Create job'}
          </button>
          <Link to="/employer" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </>
  )
}

export default EmployerJobFormPage

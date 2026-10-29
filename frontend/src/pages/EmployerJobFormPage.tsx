import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { jobsApi } from '../api/endpoints'
import EmployerNav from '../components/EmployerNav'
import PageShell from '../components/layout/PageShell'
import LoadingScreen from '../components/LoadingScreen'
import SkillsField from '../components/SkillsField'
import TagsField from '../components/TagsField'
import { useAuth } from '../hooks/useAuth'
import { apiErrorMessage } from '../lib/apiErrorMessage'
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

  const [isLoading, setIsLoading] = useState(isEdit)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!isEdit || !jobId) {
      return
    }

    let cancelled = false

    async function loadJob() {
      setIsLoading(true)
      setError(null)

      if (previewMode) {
        const job = getPreviewEmployerJob(jobId!)
        if (!cancelled) {
          if (!job) {
            setNotFound(true)
          } else {
            setTitle(job.title)
            setDescription(job.description)
            setRequiredSkills(job.required_skills ?? [])
            setTags(job.tags ?? [])
          }
          setIsLoading(false)
        }
        return
      }

      try {
        const job = normalizeJob(await jobsApi.get(jobId!))
        if (!cancelled) {
          setTitle(job.title)
          setDescription(job.description)
          setRequiredSkills(job.required_skills)
          setTags(job.tags ?? [])
        }
      } catch (err) {
        if (!cancelled) {
          setNotFound(true)
          setError(apiErrorMessage(err))
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
  }, [isEdit, jobId, previewMode])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
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

  if (notFound) {
    return <Navigate to="/employer" replace />
  }

  if (isLoading) {
    return <LoadingScreen />
  }

  return (
    <PageShell nav={<EmployerNav />} width="2xl">
        <Link to="/employer" className="text-sm font-medium text-gray-600 hover:text-gray-900">
          ← Back to jobs
        </Link>

        <h1 className="mt-4 text-2xl font-semibold text-gray-900">
          {isEdit ? 'Edit job posting' : 'Post a new job'}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Saving always sends the full job, including tags, so nothing is cleared by accident.
        </p>

        <form
          className="card-panel mt-6 space-y-6"
          onSubmit={handleSubmit}
        >
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Job title
            </label>
            <input
              id="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
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
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>

          <SkillsField skills={requiredSkills} onChange={setRequiredSkills} inputId="job_skills" />
          <TagsField tags={tags} onChange={setTags} inputId="job_tags" />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Create job'}
            </button>
            <Link
              to="/employer"
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>
        </form>
    </PageShell>
  )
}

export default EmployerJobFormPage

import { useEffect, useState, type FormEvent } from 'react'
import { profileApi } from '../api/endpoints'
import LoadingScreen from '../components/LoadingScreen'
import { useAuth } from '../hooks/useAuth'
import { apiErrorMessage } from '../lib/apiErrorMessage'
import { LIMITS } from '../lib/formLimits'
import { isPreviewUser } from '../lib/preview'
import { loadPreviewCompanyProfile, savePreviewCompanyProfile } from '../lib/employerPreview'

function EmployerProfilePage() {
  const { user } = useAuth()
  const previewMode = isPreviewUser(user?.id)

  const [companyName, setCompanyName] = useState('')
  const [description, setDescription] = useState('')
  const [saved, setSaved] = useState({ companyName: '', description: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loadWarning, setLoadWarning] = useState<string | null>(null)
  // The PUT replaces the whole company profile, so saving after a failed load would wipe the
  // stored description. Saving stays blocked until a load succeeds.
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      setIsLoading(true)
      setError(null)
      setLoadWarning(null)
      setLoadError(null)

      if (previewMode) {
        const profile = loadPreviewCompanyProfile()
        if (!cancelled) {
          setCompanyName(profile.company_name)
          setDescription(profile.description)
          setSaved({ companyName: profile.company_name, description: profile.description })
          setLoadWarning('Preview mode: company profile is stored locally in this browser.')
          setIsLoading(false)
        }
        return
      }

      try {
        const profile = await profileApi.getCompany()
        if (!cancelled) {
          setCompanyName(profile.company_name)
          setDescription(profile.description)
          setSaved({ companyName: profile.company_name, description: profile.description })
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(`Could not load your company profile (${apiErrorMessage(err)}).`)
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
  }, [previewMode, user?.id, reloadKey])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    if (loadError) {
      return
    }
    setIsSaving(true)

    const payload = {
      company_name: companyName.trim(),
      description,
    }

    try {
      if (previewMode) {
        savePreviewCompanyProfile(payload)
        setSaved({ companyName: payload.company_name, description: payload.description })
        setSuccess('Company profile saved locally (preview mode).')
      } else {
        const updated = await profileApi.updateCompany(payload)
        setCompanyName(updated.company_name)
        setDescription(updated.description)
        setSaved({ companyName: updated.company_name, description: updated.description })
        setSuccess('Company profile saved.')
      }
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  const isDirty =
    companyName.trim() !== saved.companyName.trim() || description !== saved.description

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingScreen />
      </div>
    )
  }

  if (loadError) {
    return (
      <>
        <h1 className="text-2xl font-semibold text-gray-900">Company profile</h1>
        <div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p>{loadError}</p>
          <p className="mt-1">
            Editing is disabled until your saved profile loads, so nothing you saved before gets overwritten.
          </p>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="btn-secondary mt-3">
            Retry
          </button>
        </div>
      </>
    )
  }

  return (
    <>
        <h1 className="text-2xl font-semibold text-gray-900">Company profile</h1>
        <p className="mt-2 text-sm text-gray-600">
          Candidates see your company name on job listings.
        </p>

        {loadWarning && (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {loadWarning}
          </p>
        )}

        <form
          className="card-panel mt-6 space-y-6"
          onSubmit={handleSubmit}
        >
          <div>
            <label htmlFor="company_name" className="block text-sm font-medium text-gray-700">
              Company name
            </label>
            <input
              id="company_name"
              type="text"
              required
              maxLength={LIMITS.companyNameMaxLength}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="input-field mt-1 py-2"
            />
            <p className="mt-1 text-xs text-muted">
              {companyName.length} / {LIMITS.companyNameMaxLength} characters
            </p>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="description"
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-700">{success}</p>}

          <button
            type="submit"
            disabled={isSaving || !isDirty}
            className="btn-primary disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save profile'}
          </button>
        </form>
    </>
  )
}

export default EmployerProfilePage

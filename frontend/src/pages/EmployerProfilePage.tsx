import { useEffect, useState, type FormEvent } from 'react'
import { profileApi } from '../api/endpoints'
import EmployerNav from '../components/EmployerNav'
import PageShell from '../components/layout/PageShell'
import LoadingScreen from '../components/LoadingScreen'
import { useAuth } from '../hooks/useAuth'
import { apiErrorMessage } from '../lib/apiErrorMessage'
import { isPreviewUser } from '../lib/preview'
import { loadPreviewCompanyProfile, savePreviewCompanyProfile } from '../lib/employerPreview'

function EmployerProfilePage() {
  const { user } = useAuth()
  const previewMode = isPreviewUser(user?.id)

  const [companyName, setCompanyName] = useState('')
  const [description, setDescription] = useState('')
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
        const profile = loadPreviewCompanyProfile()
        if (!cancelled) {
          setCompanyName(profile.company_name)
          setDescription(profile.description)
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
        }
      } catch (err) {
        if (!cancelled) {
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
  }, [previewMode])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setIsSaving(true)

    const payload = {
      company_name: companyName.trim(),
      description,
    }

    try {
      if (previewMode) {
        savePreviewCompanyProfile(payload)
        setSuccess('Company profile saved locally (preview mode).')
      } else {
        const updated = await profileApi.updateCompany(payload)
        setCompanyName(updated.company_name)
        setDescription(updated.description)
        setSuccess('Company profile saved.')
      }
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <LoadingScreen />
  }

  return (
    <PageShell nav={<EmployerNav />} width="2xl">
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
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
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
            disabled={isSaving}
            className="btn-primary disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save profile'}
          </button>
        </form>
    </PageShell>
  )
}

export default EmployerProfilePage

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { schedulingApi } from '../api/endpoints'
import EmployerNav from '../components/EmployerNav'
import PageShell from '../components/layout/PageShell'
import LoadingScreen from '../components/LoadingScreen'
import { useAuth } from '../hooks/useAuth'
import { apiErrorMessage } from '../lib/apiErrorMessage'
import {
  createPreviewAvailabilitySlot,
  deletePreviewAvailabilitySlot,
  loadPreviewEmployerAvailability,
} from '../lib/employerPreview'
import { isPreviewUser } from '../lib/preview'
import { formatDateTime } from '../lib/formatDateTime'
import type { EmployerSlot } from '../types'

function toLocalInputValue(date: Date): string {
  const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return copy.toISOString().slice(0, 16)
}

function defaultStartValue(): string {
  const date = new Date()
  date.setDate(date.getDate() + 2)
  date.setHours(10, 0, 0, 0)
  return toLocalInputValue(date)
}

function EmployerAvailabilityPage() {
  const { user } = useAuth()
  const previewMode = isPreviewUser(user?.id)

  const [slots, setSlots] = useState<EmployerSlot[]>([])
  const [startInput, setStartInput] = useState(defaultStartValue)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  const loadSlots = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    setInfoMessage(null)

    if (previewMode) {
      setSlots(loadPreviewEmployerAvailability())
      setInfoMessage('Preview mode: 30-minute slots shared with the candidate booking preview.')
      setIsLoading(false)
      return
    }

    try {
      const result = await schedulingApi.listMySlots()
      setSlots(result.sort((a, b) => a.start_time.localeCompare(b.start_time)))
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Could not load availability. Please try again.'))
    } finally {
      setIsLoading(false)
    }
  }, [previewMode])

  useEffect(() => {
    void loadSlots()
  }, [loadSlots])

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setActionError(null)
    setSuccess(null)
    setIsCreating(true)

    const start = new Date(startInput)
    const end = new Date(start.getTime() + 30 * 60 * 1000)
    const payload = {
      start_time: start.toISOString(),
      end_time: end.toISOString(),
    }

    try {
      if (previewMode) {
        createPreviewAvailabilitySlot(payload)
        setSlots(loadPreviewEmployerAvailability())
      } else {
        const created = await schedulingApi.createSlot(payload)
        setSlots((current) =>
          [...current, { ...created, booking: null }].sort((a, b) =>
            a.start_time.localeCompare(b.start_time),
          ),
        )
      }
      setSuccess('Availability slot created.')
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Could not create slot. Please try again.'))
    } finally {
      setIsCreating(false)
    }
  }

  async function handleDelete(slotId: string) {
    setActionError(null)
    setSuccess(null)
    setDeletingId(slotId)

    try {
      if (previewMode) {
        deletePreviewAvailabilitySlot(slotId)
        setSlots(loadPreviewEmployerAvailability())
      } else {
        await schedulingApi.deleteSlot(slotId)
        setSlots((current) => current.filter((slot) => slot.id !== slotId))
      }
      setSuccess('Slot deleted.')
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Could not delete slot. Please try again.'))
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) {
    return <LoadingScreen />
  }

  return (
    <PageShell nav={<EmployerNav />} width="3xl">
        <h1 className="text-2xl font-semibold text-gray-900">Interview availability</h1>
        <p className="mt-2 text-sm text-gray-600">
          Create future 30-minute slots for candidates to book when their application is{' '}
          <span className="font-medium">Interviewing</span>.
        </p>

        {infoMessage && (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {infoMessage}
          </p>
        )}

        {loadError && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <p>{loadError}</p>
            <button type="button" onClick={() => void loadSlots()} className="mt-2 font-medium underline">
              Retry
            </button>
          </div>
        )}

        <form
          className="card-panel mt-6"
          onSubmit={handleCreate}
        >
          <label htmlFor="start_time" className="block text-sm font-medium text-gray-700">
            Slot start time
          </label>
          <p className="mt-1 text-xs text-gray-500">Each slot is exactly 30 minutes (stored as UTC).</p>
          <input
            id="start_time"
            type="datetime-local"
            required
            value={startInput}
            onChange={(e) => setStartInput(e.target.value)}
            className="mt-2 w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />

          {actionError && <p className="mt-3 text-sm text-red-600">{actionError}</p>}
          {success && <p className="mt-3 text-sm text-green-700">{success}</p>}

          <button
            type="submit"
            disabled={isCreating}
            className="btn-primary mt-4 disabled:opacity-50"
          >
            {isCreating ? 'Creating…' : 'Add slot'}
          </button>
        </form>

        {slots.length === 0 ? (
          <p className="mt-6 rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-600">
            No availability slots yet.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {slots.map((slot) => (
              <li
                key={slot.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {formatDateTime(slot.start_time)} – {formatDateTime(slot.end_time)}
                  </p>
                  <p className="mt-1 text-xs text-gray-600">
                    {slot.booking
                      ? `Booked by ${slot.booking.candidate_display_name} (${slot.booking.job_title})`
                      : slot.is_booked
                        ? 'Booked'
                        : 'Available'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(slot.id)}
                  disabled={slot.is_booked || deletingId === slot.id}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  {deletingId === slot.id ? 'Deleting…' : 'Delete'}
                </button>
              </li>
            ))}
          </ul>
        )}
    </PageShell>
  )
}

export default EmployerAvailabilityPage

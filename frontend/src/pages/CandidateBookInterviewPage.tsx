import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { applicationsApi, schedulingApi } from '../api/endpoints'
import ApplicationStatusBadge from '../components/ApplicationStatusBadge'
import LoadingScreen from '../components/LoadingScreen'
import { useAuth } from '../hooks/useAuth'
import { apiErrorMessage, isStaleStateError } from '../lib/apiErrorMessage'
import { formatDateTime } from '../lib/formatDateTime'
import { interviewSummary } from '../lib/interviewDisplay'
import { normalizeScoredApplication } from '../lib/normalizeApi'
import {
  bookPreviewInterviewSlot,
  getPreviewApplicationById,
  isPreviewUser,
  loadPreviewAvailableSlots,
} from '../lib/preview'
import type { AvailabilitySlot, ScoredApplication } from '../types'

function CandidateBookInterviewPage() {
  const { applicationId } = useParams<{ applicationId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const previewMode = isPreviewUser(user?.id)

  const [application, setApplication] = useState<ScoredApplication | null>(null)
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [isBooking, setIsBooking] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [bookError, setBookError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  // `silent` refreshes in place (no full-page spinner) after a conflict.
  const loadPage = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!applicationId) {
      return
    }

    if (!silent) {
      setIsLoading(true)
      setInfoMessage(null)
    }
    setLoadError(null)
    // bookError is deliberately not cleared here: after a 409 conflict the page reloads the
    // slot list and the explanation must stay visible. handleBook clears it on the next try.

    if (previewMode) {
      const previewApplication = getPreviewApplicationById(applicationId)
      if (!previewApplication) {
        setLoadError('Application not found.')
        setIsLoading(false)
        return
      }
      setApplication(previewApplication)
      setSlots(loadPreviewAvailableSlots(applicationId))
      setInfoMessage('Preview mode: sample 30-minute slots for this employer.')
      setIsLoading(false)
      return
    }

    try {
      const applications = await applicationsApi.listMine()
      const match = applications.find((item) => item.id === applicationId)
      if (!match) {
        setLoadError('Application not found.')
        setIsLoading(false)
        return
      }
      setApplication(normalizeScoredApplication(match))

      if (match.status === 'Interviewing' && !match.interview_slot_id) {
        const available = await schedulingApi.availableSlots(applicationId)
        setSlots(available)
      } else {
        setSlots([])
      }
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Could not load booking details. Please try again.'))
    } finally {
      setIsLoading(false)
    }
  }, [applicationId, previewMode])

  useEffect(() => {
    setBookError(null)
    setSelectedSlotId(null)
    void loadPage()
  }, [loadPage])

  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId)

  async function handleBook() {
    if (!applicationId || !selectedSlot || isBooking) {
      return
    }

    setBookError(null)
    setIsBooking(true)

    try {
      if (previewMode) {
        bookPreviewInterviewSlot(applicationId, selectedSlot.id)
      } else {
        await schedulingApi.book(applicationId, selectedSlot.id)
      }
      navigate('/candidate/applications', {
        replace: true,
        state: { bookingSuccess: true },
      })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SLOT_TAKEN') {
        setBookError(apiErrorMessage(err))
      } else {
        setBookError(apiErrorMessage(err, 'Could not book the slot. Please try again.'))
      }
      // 409 (SLOT_TAKEN, SLOT_IN_PAST, NOT_INTERVIEWING, ALREADY_BOOKED) or 404: what's on screen
      // is stale. Reload slots and status, and drop the selection since that slot may be gone.
      if (isStaleStateError(err)) {
        setSelectedSlotId(null)
        await loadPage({ silent: true })
      }
    } finally {
      setIsBooking(false)
    }
  }

  if (!applicationId) {
    return <Navigate to="/candidate/applications" replace />
  }

  if (isLoading) {
    return <LoadingScreen />
  }

  if (loadError || !application) {
    return (
      <>
        <p className="rounded-panel border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {loadError ?? 'Application not found.'}
        </p>
        <Link to="/candidate/applications" className="btn-secondary mt-4 inline-block">
          Back to applications
        </Link>
      </>
    )
  }

  const alreadyBooked = Boolean(application.interview_slot_id)

  return (
    <>
        <Link to="/candidate/applications" className="text-sm font-semibold text-brand">
          ← Back to applications
        </Link>

        <p className="eyebrow mt-6">Schedule</p>
        <h1 className="page-heading">Book interview</h1>
        <p className="mt-2 text-sm text-gray-600">
          Choose a 30-minute slot for{' '}
          <span className="font-medium text-gray-900">{application.job?.title ?? 'this job'}</span>.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ApplicationStatusBadge status={application.status} interviewBooked={alreadyBooked} />
          {alreadyBooked && (
            <span className="text-sm text-gray-600">{interviewSummary(application)}</span>
          )}
        </div>

        {infoMessage && (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {infoMessage}
          </p>
        )}

        {/* Outside the slot list so it stays visible even if no slots are left after a conflict. */}
        {bookError && (
          <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {bookError}
          </p>
        )}

        {application.status !== 'Interviewing' && (
          <p className="mt-6 rounded-md border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
            Booking is only available when your application status is{' '}
            <span className="font-medium">Interviewing</span>.
          </p>
        )}

        {application.status === 'Interviewing' && alreadyBooked && (
          <p className="mt-6 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            You already have an interview booked for this application.
          </p>
        )}

        {application.status === 'Interviewing' && !alreadyBooked && slots.length === 0 && (
          <p className="mt-6 rounded-md border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-600">
            No available interview slots right now. Check back later.
          </p>
        )}

        {application.status === 'Interviewing' && !alreadyBooked && slots.length > 0 && (
          <div className="mt-6 space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <fieldset>
              <legend className="text-sm font-medium text-gray-900">Available slots</legend>
              <ul className="mt-3 space-y-2">
                {slots.map((slot) => (
                  <li key={slot.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-md border border-gray-200 px-4 py-3 hover:bg-gray-50">
                      <input
                        type="radio"
                        name="slot"
                        value={slot.id}
                        checked={selectedSlotId === slot.id}
                        onChange={() => setSelectedSlotId(slot.id)}
                        className="h-4 w-4 border-gray-300 text-gray-900"
                      />
                      <span className="text-sm text-gray-800">
                        {formatDateTime(slot.start_time)} – {formatDateTime(slot.end_time)}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>

            <button
              type="button"
              onClick={() => void handleBook()}
              disabled={!selectedSlot || isBooking}
              className="btn-primary disabled:opacity-50"
            >
              {isBooking ? 'Booking…' : 'Confirm booking'}
            </button>
          </div>
        )}
    </>
  )
}

export default CandidateBookInterviewPage

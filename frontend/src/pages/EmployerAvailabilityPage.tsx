import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { schedulingApi } from '../api/endpoints'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import LoadingScreen from '../components/LoadingScreen'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { apiErrorMessage } from '../lib/apiErrorMessage'
import {
  createPreviewAvailabilitySlot,
  deletePreviewAvailabilitySlot,
  loadPreviewEmployerAvailability,
} from '../lib/employerPreview'
import { isPreviewUser } from '../lib/preview'
import { formatDateTime } from '../lib/formatDateTime'
import {
  clampSlotStartInput,
  minDateTimeLocalNow,
  roundToHalfHourLocal,
  toLocalDateTimeInputValue,
} from '../lib/slotTimeInput'
import type { EmployerSlot } from '../types'

function defaultStartValue(): string {
  const date = new Date()
  date.setDate(date.getDate() + 2)
  date.setHours(10, 0, 0, 0)
  return toLocalDateTimeInputValue(date)
}

function groupSlotsByDay(slots: EmployerSlot[]): Map<string, EmployerSlot[]> {
  const groups = new Map<string, EmployerSlot[]>()
  for (const slot of slots) {
    const dayKey = new Date(slot.start_time).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    const list = groups.get(dayKey) ?? []
    list.push(slot)
    groups.set(dayKey, list)
  }
  return groups
}

function EmployerAvailabilityPage() {
  const { user } = useAuth()
  const previewMode = isPreviewUser(user?.id)
  const { pushToast } = useToast()

  const [slots, setSlots] = useState<EmployerSlot[]>([])
  const [minInput, setMinInput] = useState(minDateTimeLocalNow)
  const [startInput, setStartInput] = useState(() =>
    clampSlotStartInput(defaultStartValue(), minDateTimeLocalNow()),
  )
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [slotPendingDelete, setSlotPendingDelete] = useState<EmployerSlot | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
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

  useEffect(() => {
    const tick = () => {
      const nextMin = minDateTimeLocalNow()
      setMinInput(nextMin)
      setStartInput((current) => clampSlotStartInput(current, nextMin))
    }
    tick()
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [])

  const nowMs = Date.now()
  const { upcoming, past } = useMemo(() => {
    const up: EmployerSlot[] = []
    const old: EmployerSlot[] = []
    for (const slot of slots) {
      if (new Date(slot.end_time).getTime() < nowMs) {
        old.push(slot)
      } else {
        up.push(slot)
      }
    }
    return { upcoming: up, past: old }
  }, [slots, nowMs])

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setActionError(null)
    setIsCreating(true)

    const rounded = roundToHalfHourLocal(startInput)
    const start = new Date(rounded)
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
      pushToast('Availability slot added', 'success')
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Could not create slot. Please try again.'))
    } finally {
      setIsCreating(false)
    }
  }

  async function confirmDelete() {
    const slot = slotPendingDelete
    if (!slot) {
      return
    }
    setSlotPendingDelete(null)
    setDeletingId(slot.id)

    try {
      if (previewMode) {
        deletePreviewAvailabilitySlot(slot.id)
        setSlots(loadPreviewEmployerAvailability())
      } else {
        await schedulingApi.deleteSlot(slot.id)
        setSlots((current) => current.filter((item) => item.id !== slot.id))
      }
      pushToast('Slot deleted', 'error')
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Could not delete slot. Please try again.'))
    } finally {
      setDeletingId(null)
    }
  }

  function renderSlotList(list: EmployerSlot[]) {
    const groups = groupSlotsByDay(list)
    return (
      <ul className="mt-3 space-y-4">
        {[...groups.entries()].map(([day, daySlots]) => (
          <li key={day}>
            <p className="text-sm font-semibold text-ink">{day}</p>
            <ul className="mt-2 space-y-2">
              {daySlots.map((slot) => (
                <li
                  key={slot.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {formatDateTime(slot.start_time)} – {formatDateTime(slot.end_time)}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {slot.booking
                        ? `Booked by ${slot.booking.candidate_display_name} (${slot.booking.job_title})`
                        : slot.is_booked
                          ? 'Booked'
                          : 'Available'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSlotPendingDelete(slot)}
                    disabled={slot.is_booked || deletingId === slot.id}
                    className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deletingId === slot.id ? 'Deleting…' : 'Delete'}
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    )
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
      <h1 className="text-2xl font-semibold text-ink">Interview availability</h1>
      <p className="mt-2 text-sm text-muted">
        Create future 30-minute slots for candidates to book when their application is{' '}
        <span className="font-medium">Interviewing</span>.
      </p>

      {infoMessage && (
        <p className="mt-4 rounded-panel border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {infoMessage}
        </p>
      )}

      {loadError && (
        <div className="mt-4 rounded-panel border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p>{loadError}</p>
          <button type="button" onClick={() => void loadSlots()} className="mt-2 font-medium underline">
            Retry
          </button>
        </div>
      )}

      <form className="card-panel mt-6" onSubmit={handleCreate}>
        <label htmlFor="start_time" className="block text-sm font-medium text-gray-700">
          Slot start time
        </label>
        <p className="mt-1 text-xs text-muted">
          Each slot is exactly 30 minutes. Times are entered in your local time (:00 or :30 only).
        </p>
        <input
          id="start_time"
          type="datetime-local"
          required
          step={1800}
          min={minInput}
          value={startInput}
          onChange={(e) =>
            setStartInput(clampSlotStartInput(e.target.value, minInput))
          }
          onBlur={() => setStartInput((value) => clampSlotStartInput(value, minInput))}
          className="input-field mt-2 max-w-xs py-2"
        />

        {actionError && <p className="mt-3 text-sm text-red-600">{actionError}</p>}

        <button type="submit" disabled={isCreating} className="btn-primary mt-4 disabled:opacity-50">
          {isCreating ? 'Creating…' : 'Add slot'}
        </button>
      </form>

      {slots.length === 0 ? (
        <p className="mt-6 rounded-panel border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
          No availability slots yet. Add your first slot above.
        </p>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-ink">Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No upcoming slots.</p>
            ) : (
              renderSlotList(upcoming)
            )}
          </section>
          {past.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-muted">Past</h2>
              {renderSlotList(past)}
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={Boolean(slotPendingDelete)}
        title="Delete slot?"
        message="Remove this interview slot? Candidates will no longer be able to book it."
        confirmLabel="Delete"
        onCancel={() => setSlotPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  )
}

export default EmployerAvailabilityPage

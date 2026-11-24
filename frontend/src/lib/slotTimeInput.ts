export function toLocalDateTimeInputValue(date: Date): string {
  const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return copy.toISOString().slice(0, 16)
}

/** Return every instant represented by a local wall time, in chronological order. */
export function localDateTimeInstants(value: string): Date[] {
  const first = new Date(value)
  if (Number.isNaN(first.getTime()) || toLocalDateTimeInputValue(first) !== value) return []

  const dayMs = 86_400_000
  // Offsets on either side of this date let us detect a repeated time, including non-hour shifts.
  const offsets = new Set([
    new Date(first.getTime() - dayMs).getTimezoneOffset(),
    first.getTimezoneOffset(),
    new Date(first.getTime() + dayMs).getTimezoneOffset(),
  ])
  return [...offsets]
    .map((offset) => new Date(first.getTime() + (offset - first.getTimezoneOffset()) * 60_000))
    .filter((date) => toLocalDateTimeInputValue(date) === value)
    .sort((a, b) => a.getTime() - b.getTime())
}

export function formatUtcOffset(date: Date): string {
  const offset = -date.getTimezoneOffset()
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')
  const minutes = String(Math.abs(offset) % 60).padStart(2, '0')
  return `UTC${offset < 0 ? '-' : '+'}${hours}:${minutes}`
}

/** Round a local datetime-local value to the nearest :00 or :30. */
export function roundToHalfHourLocal(inputValue: string): string {
  if (!inputValue) {
    return inputValue
  }
  const date = new Date(inputValue)
  if (Number.isNaN(date.getTime())) {
    return inputValue
  }
  const minutes = date.getMinutes()
  if (minutes < 15) {
    date.setMinutes(0, 0, 0)
  } else if (minutes < 45) {
    date.setMinutes(30, 0, 0)
  } else {
    date.setHours(date.getHours() + 1, 0, 0, 0)
  }
  return toLocalDateTimeInputValue(date)
}

/**
 * Keep value on :00/:30 and not before min (datetime-local string compare). Empty stays empty.
 * The availability form no longer calls this (it validates on submit instead, so it never
 * silently changes a time the user typed); it is kept because the BUG-FE-7 regression test
 * in testing/ imports it.
 */
export function clampSlotStartInput(value: string, min: string): string {
  if (!value) {
    return value
  }
  let next = roundToHalfHourLocal(value)
  if (min && next < min) {
    next = min
  }
  return next
}

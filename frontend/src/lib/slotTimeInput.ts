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

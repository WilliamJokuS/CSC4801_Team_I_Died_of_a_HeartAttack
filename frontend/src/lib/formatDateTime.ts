/** FP-SCHED-1: show viewer-local time with an explicit zone label. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  try {
    const when = date.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
    const zone =
      new Intl.DateTimeFormat(undefined, { timeZoneName: 'shortOffset' })
        .formatToParts(date)
        .find((part) => part.type === 'timeZoneName')?.value ?? ''
    return zone ? `${when} ${zone}` : when
  } catch {
    return date.toLocaleString()
  }
}

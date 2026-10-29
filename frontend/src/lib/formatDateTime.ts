export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  // dateStyle/timeStyle cannot be combined with timeZoneName (throws in V8/Chrome).
  try {
    return date.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return date.toLocaleString()
  }
}

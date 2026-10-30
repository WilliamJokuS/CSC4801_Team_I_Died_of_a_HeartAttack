export function toLocalDateTimeInputValue(date: Date): string {
  const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return copy.toISOString().slice(0, 16)
}

/** Round local datetime-local value to nearest :00 or :30. */
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

/** Earliest selectable slot start: now rounded up to the next :00 or :30 (local). */
export function ceilToHalfHourLocal(date: Date): Date {
  const copy = new Date(date)
  const minutes = copy.getMinutes()
  const seconds = copy.getSeconds()
  const ms = copy.getMilliseconds()
  const onHalfHour =
    (minutes === 0 || minutes === 30) && seconds === 0 && ms === 0
  if (onHalfHour) {
    return copy
  }
  if (minutes < 30) {
    copy.setMinutes(30, 0, 0)
  } else {
    copy.setHours(copy.getHours() + 1, 0, 0, 0)
  }
  return copy
}

export function minDateTimeLocalNow(): string {
  return toLocalDateTimeInputValue(ceilToHalfHourLocal(new Date()))
}

/** Keep value on :00/:30 and not before min (datetime-local string compare). */
export function clampSlotStartInput(value: string, min: string): string {
  let next = roundToHalfHourLocal(value)
  if (min && next < min) {
    next = min
  }
  return next
}

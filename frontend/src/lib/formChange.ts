/**
 * Order-sensitive: tags[0] is shown as the primary tag on job cards, so reordering is a real
 * change that must enable "Save changes".
 */
export function stringArraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false
  }
  return a.every((value, index) => value.trim() === b[index].trim())
}

export function hasPendingText(form: HTMLFormElement, inputId: string): boolean {
  const input = form.elements.namedItem(inputId)
  return input instanceof HTMLInputElement && input.value.trim().length > 0
}

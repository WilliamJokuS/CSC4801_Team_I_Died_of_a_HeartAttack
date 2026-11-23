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

/**
 * Text typed into a skill/tag box but not yet added with Enter / "Add". Appended on submit so
 * it isn't silently dropped. Same rules as the field: trim, max length, no case-insensitive
 * duplicates, max count.
 */
export function withDraftEntry(list: string[], draft: string, maxLength: number, maxCount: number): string[] {
  const trimmed = draft.trim().slice(0, maxLength)
  if (!trimmed || list.length >= maxCount) {
    return list
  }
  if (list.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
    return list
  }
  return [...list, trimmed]
}

import { useState, type KeyboardEvent } from 'react'
import { LIMITS } from '../lib/formLimits'

interface TagsFieldProps {
  tags: string[]
  onChange: (tags: string[]) => void
  label?: string
  inputId?: string
  maxTags?: number
  /** Optional controlled draft text, so the parent form can commit it on submit. */
  draft?: string
  onDraftChange?: (draft: string) => void
}

function TagsField({
  tags,
  onChange,
  label = 'Tags',
  inputId = 'tag_input',
  maxTags = LIMITS.tagsMaxCount,
  draft,
  onDraftChange,
}: TagsFieldProps) {
  const [localInput, setLocalInput] = useState('')
  const tagInput = draft ?? localInput
  const setTagInput = (value: string) => (onDraftChange ? onDraftChange(value) : setLocalInput(value))

  function addTag(raw: string) {
    const trimmed = raw.trim().slice(0, LIMITS.tagMaxLength)
    if (!trimmed || tags.length >= maxTags) {
      return
    }
    if (tags.some((tag) => tag.toLowerCase() === trimmed.toLowerCase())) {
      setTagInput('')
      return
    }
    onChange([...tags, trimmed])
    setTagInput('')
  }

  function removeTag(tagToRemove: string) {
    onChange(tags.filter((tag) => tag !== tagToRemove))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTag(tagInput)
    }
  }

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <p className="mt-1 text-xs text-gray-500">
        Press Enter or comma to add. Max {maxTags} tags, {LIMITS.tagMaxLength} characters each.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          id={inputId}
          type="text"
          value={tagInput}
          maxLength={LIMITS.tagMaxLength}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={tags.length >= maxTags}
          placeholder="e.g. Remote"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => addTag(tagInput)}
          disabled={tags.length >= maxTags}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Add
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        {tagInput.length} / {LIMITS.tagMaxLength} characters in input
      </p>
      {tags.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li key={tag}>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-900">
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  aria-label={`Remove ${tag}`}
                  className="text-blue-700 hover:text-blue-950"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-gray-500">No tags added.</p>
      )}
    </div>
  )
}

export default TagsField

import { useState, type KeyboardEvent } from 'react'
import { LIMITS } from '../lib/formLimits'

interface SkillsFieldProps {
  skills: string[]
  onChange: (skills: string[]) => void
  inputId?: string
  label?: string
  hint?: string
  disabled?: boolean
}

function SkillsField({
  skills,
  onChange,
  inputId = 'skill_input',
  label = 'Required skills',
  hint = 'Press Enter or comma to add each skill (max 50).',
  disabled = false,
}: SkillsFieldProps) {
  const [skillInput, setSkillInput] = useState('')

  function addSkill(raw: string) {
    const trimmed = raw.trim().slice(0, LIMITS.skillMaxLength)
    if (!trimmed) {
      return
    }
    if (skills.length >= LIMITS.skillsMaxCount) {
      return
    }
    const normalized = trimmed.toLowerCase()
    if (skills.some((skill) => skill.toLowerCase() === normalized)) {
      setSkillInput('')
      return
    }
    onChange([...skills, trimmed])
    setSkillInput('')
  }

  function removeSkill(skillToRemove: string) {
    onChange(skills.filter((skill) => skill !== skillToRemove))
  }

  function handleSkillKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addSkill(skillInput)
    }
  }

  return (
    <div>
      {label ? (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      ) : null}
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
      <div className="mt-2 flex gap-2">
        <input
          id={inputId}
          type="text"
          value={skillInput}
          maxLength={LIMITS.skillMaxLength}
          onChange={(e) => setSkillInput(e.target.value)}
          onKeyDown={handleSkillKeyDown}
          disabled={disabled || skills.length >= LIMITS.skillsMaxCount}
          placeholder="e.g. Python"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => addSkill(skillInput)}
          disabled={disabled || skills.length >= LIMITS.skillsMaxCount}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Add
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        {skills.length} / {LIMITS.skillsMaxCount} skills · {skillInput.length} / {LIMITS.skillMaxLength} chars in
        input
      </p>
      {skills.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {skills.map((skill) => (
            <li key={skill}>
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-800">
                {skill}
                <button
                  type="button"
                  onClick={() => removeSkill(skill)}
                  disabled={disabled}
                  aria-label={`Remove ${skill}`}
                  className="text-gray-500 hover:text-gray-900"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-gray-500">No skills added.</p>
      )}
    </div>
  )
}

export default SkillsField

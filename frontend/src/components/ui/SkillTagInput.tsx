import { useState } from 'react';

interface SkillTagInputProps {
  label: string;
  skills: string[];
  onChange: (skills: string[]) => void;
  placeholder?: string;
}

export function SkillTagInput({ label, skills, onChange, placeholder }: SkillTagInputProps) {
  const [input, setInput] = useState('');

  function addSkill() {
    const skill = input.trim();
    const normalized = skill.toLowerCase();
    if (!normalized || skills.some((item) => item.toLowerCase() === normalized)) {
      setInput('');
      return;
    }
    onChange([...skills, skill]);
    setInput('');
  }

  function removeSkill(skill: string) {
    onChange(skills.filter((s) => s !== skill));
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="skill-input" className="text-sm font-medium text-text-primary">{label}</label>
      <div className="flex min-h-11 flex-wrap gap-2 rounded-xl border border-border bg-background p-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15">
        {skills.map((skill) => (
          <span
            key={skill}
            className="inline-flex items-center gap-1 rounded-full bg-info-bg px-2.5 py-0.5 text-xs font-medium text-accent"
          >
            {skill}
            <button
              type="button"
              onClick={() => removeSkill(skill)}
              className="text-accent/60 hover:text-accent"
              aria-label={`Remove skill ${skill}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id="skill-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              addSkill();
            }
          }}
          onBlur={addSkill}
          placeholder={placeholder ?? 'Type a skill and press Enter'}
          className="min-w-[10rem] flex-1 bg-transparent px-1 text-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none"
        />
      </div>
    </div>
  );
}

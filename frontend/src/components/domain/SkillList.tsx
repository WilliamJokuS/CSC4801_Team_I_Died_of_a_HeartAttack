

interface SkillListProps {
  skills: string[];
  maxVisible?: number;
}

export function SkillList({ skills, maxVisible = 5 }: SkillListProps) {
  const visible = skills.slice(0, maxVisible);
  const overflow = skills.length - maxVisible;

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((skill) => (
        <span
          key={skill}
          className="inline-flex rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-medium text-text-secondary"
        >
          {skill}
        </span>
      ))}
      {overflow > 0 && (
        <span className="text-xs text-text-secondary">+{overflow} more</span>
      )}
    </div>
  );
}

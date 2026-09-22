import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SkillList } from './SkillList';
import { MatchScoreBadge } from './MatchScoreBadge';
import type { ScoredJob } from '@/types';

interface JobCardProps {
  job: ScoredJob;
  onApply?: (jobId: string) => void;
}

export function JobCard({ job, onApply }: JobCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">{job.title}</h3>
          <p className="text-sm text-text-secondary">{job.company_name}</p>
        </div>
        <MatchScoreBadge score={job.match_score} />
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-text-secondary">
          Required skills
        </p>
        <SkillList skills={job.required_skills} />
      </div>

      {expanded && (
        <div className="border-t border-border pt-3">
          <p className="text-sm leading-relaxed text-text-primary">{job.description}</p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Hide details' : 'View details'}
        </Button>
        {job.has_applied ? (
          <span className="text-sm font-medium text-success">Applied</span>
        ) : (
          <Button size="sm" onClick={() => onApply?.(job.id)}>
            Apply
          </Button>
        )}
      </div>
    </Card>
  );
}

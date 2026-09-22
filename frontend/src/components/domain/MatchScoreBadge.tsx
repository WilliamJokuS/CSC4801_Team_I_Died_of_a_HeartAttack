
import { Badge } from '@/components/ui/Badge';

interface MatchScoreBadgeProps {
  score: number;
}

export function MatchScoreBadge({ score }: MatchScoreBadgeProps) {
  const color =
    score >= 80
      ? 'bg-success/10 text-success border-success/20'
      : score >= 50
        ? 'bg-warning/10 text-warning border-warning/20'
        : 'bg-surface text-text-secondary border-border';

  return (
    <Badge className={`border ${color}`}>
      <span className="font-bold">{score}</span>
      <span className="ml-1 text-xs">Match</span>
    </Badge>
  );
}

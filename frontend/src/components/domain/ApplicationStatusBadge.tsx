
import { Badge } from '@/components/ui/Badge';
import type { ApplicationStatus } from '@/types';

const statusStyles: Record<ApplicationStatus, string> = {
  Pending: 'bg-pending/10 text-pending border-pending/20',
  Interviewing: 'bg-interviewing/10 text-interviewing border-interviewing/20',
  Rejected: 'bg-rejected/10 text-rejected border-rejected/20',
  Accepted: 'bg-accepted/10 text-accepted border-accepted/20',
};

const statusIcons: Record<ApplicationStatus, string> = {
  Pending: '🕐',
  Interviewing: '📅',
  Rejected: '✕',
  Accepted: '✓',
};

interface ApplicationStatusBadgeProps {
  status: ApplicationStatus;
}

export function ApplicationStatusBadge({ status }: ApplicationStatusBadgeProps) {
  return (
    <Badge className={`border ${statusStyles[status]}`}>
      <span aria-hidden="true">{statusIcons[status]}</span>
      <span>{status}</span>
    </Badge>
  );
}

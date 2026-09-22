
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/utils';

interface TimeSlotCardProps {
  slot: {
    id: string;
    start_time: string;
    end_time: string;
    is_booked: boolean;
  };
  onBook?: () => void;
  onDelete?: () => void;
}

export function TimeSlotCard({ slot, onBook, onDelete }: TimeSlotCardProps) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-text-primary">
            {formatDateTime(slot.start_time)} – {formatDateTime(slot.end_time)}
          </p>
          <p className="text-xs text-text-secondary">
            {slot.is_booked ? 'Booked' : 'Available'}
          </p>
        </div>
        {onBook && !slot.is_booked && <Button size="sm" onClick={onBook}>Book</Button>}
        {onDelete && !slot.is_booked && (
          <Button variant="danger" size="sm" onClick={onDelete}>
            Delete
          </Button>
        )}
      </div>
    </Card>
  );
}

import { useState } from 'react';
import { AppShell } from '@/layouts/AppShell';
import { TimeSlotCard } from '@/components/domain/TimeSlotCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { availableSlots } from '@/lib/mockData';
import type { AuthUser } from '@/types';

export function EmployerAvailabilityPage({ user }: { user: AuthUser }) {
  const [slots, setSlots] = useState(availableSlots);
  const [startTime, setStartTime] = useState('');

  function addSlot() {
    if (!startTime) return;
    const start = new Date(startTime);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    setSlots((prev) => [
      ...prev,
      {
        id: `slot-${Date.now()}`,
        employer_id: user.id,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        is_booked: false,
      },
    ]);
    setStartTime('');
  }

  return (
    <AppShell user={user}>
      <h1 className="mb-6 text-2xl font-bold text-text-primary">Availability</h1>

      <Card className="mb-6 flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text-primary">Add a slot</h2>
        <input
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary"
        />
        <Button size="sm" className="self-start" onClick={addSlot}>
          Add Slot
        </Button>
      </Card>

      <div className="flex flex-col gap-4">
        {slots.map((slot) => (
          <TimeSlotCard
            key={slot.id}
            slot={slot}
            onDelete={
              slot.is_booked
                ? undefined
                : () =>
                    setSlots((prev) => prev.filter((s) => s.id !== slot.id))
            }
          />
        ))}
      </div>
    </AppShell>
  );
}

import { useState } from 'react';
import { AppShell } from '@/layouts/AppShell';
import { TimeSlotCard } from '@/components/domain/TimeSlotCard';
import { ConfirmDialog } from '@/components/domain/ConfirmDialog';
import { Card } from '@/components/ui/Card';
import { availableSlots } from '@/lib/mockData';
import type { AuthUser } from '@/types';

export function CandidateInterviewsPage({ user }: { user: AuthUser }) {
  const [slots, setSlots] = useState(availableSlots);
  const [booking, setBooking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirmBooking() {
    if (!booking) return;
    setError(null);
    // TODO: Replace with real API call
    await new Promise((r) => setTimeout(r, 500));
    setSlots((prev) =>
      prev.map((s) => (s.id === booking ? { ...s, is_booked: true } : s))
    );
    setBooking(null);
  }

  const available = slots.filter((s) => !s.is_booked);
  const booked = slots.filter((s) => s.is_booked);

  return (
    <AppShell user={user}>
      <h1 className="mb-6 text-2xl font-bold text-text-primary">Interview Bookings</h1>
      {error && (
        <Card className="mb-4 border-warning bg-warning/10 text-warning">
          {error}
        </Card>
      )}

      <h2 className="mb-3 text-lg font-semibold text-text-primary">Available slots</h2>
      <div className="mb-8 flex flex-col gap-4">
        {available.length === 0 ? (
          <Card>
            <p className="text-sm text-text-secondary">No available slots right now.</p>
          </Card>
        ) : (
          available.map((slot) => (
            <TimeSlotCard
              key={slot.id}
              slot={slot}
              onBook={() => setBooking(slot.id)}
            />
          ))
        )}
      </div>

      <h2 className="mb-3 text-lg font-semibold text-text-primary">Confirmed bookings</h2>
      <div className="flex flex-col gap-4">
        {booked.length === 0 ? (
          <Card>
            <p className="text-sm text-text-secondary">No confirmed bookings yet.</p>
          </Card>
        ) : (
          booked.map((slot) => <TimeSlotCard key={slot.id} slot={slot} />)
        )}
      </div>

      <ConfirmDialog
        open={!!booking}
        title="Confirm booking"
        message="Are you sure you want to book this slot?"
        confirmLabel="Book slot"
        onConfirm={confirmBooking}
        onCancel={() => setBooking(null)}
      />
    </AppShell>
  );
}

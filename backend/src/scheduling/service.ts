import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client.js';
import { Prisma } from '../generated/prisma/client.js';
import { HttpError, badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { toApplication, type Application } from '../applications/service.js';

export interface SchedulingDeps {
  prisma: PrismaClient;
  /** Injectable clock so "in the future" checks are testable. */
  now?: () => Date;
}

export interface AvailabilitySlot {
  id: string;
  employer_id: string;
  start_time: string; // ISO 8601 UTC
  end_time: string;
  is_booked: boolean;
}

/** GET /api/employers/me/availability only: the owner's view adds who booked it (specs/004). */
export interface EmployerSlot extends AvailabilitySlot {
  booking: {
    application_id: string;
    job_id: string;
    job_title: string;
    candidate_id: string;
    candidate_display_name: string;
  } | null;
}

export const SLOT_MINUTES = 30;
const SLOT_MS = SLOT_MINUTES * 60_000;

// Timestamps must carry Z or an explicit offset, so the instant is unambiguous (FP-SCHED-1).
// Stored as timestamptz and always returned in UTC.
const instant = z.iso.datetime({ offset: true, message: 'must be an ISO 8601 timestamp with Z or an offset' });

export const slotInputSchema = z.object({ start_time: instant, end_time: instant });
export const bookInputSchema = z.object({ slot_id: z.uuid({ message: 'must be a UUID' }) });

type SlotRow = { id: string; employerId: string; startTime: Date; endTime: Date; isBooked: boolean };

export function toSlot(row: SlotRow): AvailabilitySlot {
  return {
    id: row.id,
    employer_id: row.employerId,
    start_time: row.startTime.toISOString(),
    end_time: row.endTime.toISOString(),
    is_booked: row.isBooked,
  };
}

const clock = (deps: SchedulingDeps) => (deps.now ?? (() => new Date()))();

/**
 * FP-SCHED-1 validation, pure so it can be unit tested: start must be in the future, end must
 * be after start, and the slot must be exactly 30 minutes. The DB CHECK constraint enforces
 * the duration again.
 */
export function validateSlotTimes(start: Date, end: Date, now: Date): string | null {
  if (end.getTime() <= start.getTime()) return 'end_time must be after start_time';
  if (end.getTime() - start.getTime() !== SLOT_MS) return `slot must be exactly ${SLOT_MINUTES} minutes`;
  if (start.getTime() <= now.getTime()) return 'start_time must be in the future';
  return null;
}

/**
 * The employer's own slots (booked and open), earliest first. Booked slots name the job and the
 * candidate's display name only, never their email, skills, or resume (FP-CAN-1).
 */
export async function listMySlots(deps: SchedulingDeps, employerId: string): Promise<EmployerSlot[]> {
  const slots = await deps.prisma.availabilitySlot.findMany({
    where: { employerId },
    orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
    include: {
      application: {
        select: {
          id: true,
          job: { select: { id: true, title: true } },
          candidate: { select: { id: true, displayName: true } },
        },
      },
    },
  });
  return slots.map((slot) => ({
    ...toSlot(slot),
    booking: slot.application && {
      application_id: slot.application.id,
      job_id: slot.application.job.id,
      job_title: slot.application.job.title,
      candidate_id: slot.application.candidate.id,
      candidate_display_name: slot.application.candidate.displayName,
    },
  }));
}

export async function createSlot(deps: SchedulingDeps, employerId: string, input: unknown): Promise<AvailabilitySlot> {
  const data = slotInputSchema.parse(input);
  const start = new Date(data.start_time);
  const end = new Date(data.end_time);
  const problem = validateSlotTimes(start, end, clock(deps));
  if (problem) throw badRequest(problem);
  const slot = await deps.prisma.availabilitySlot.create({ data: { employerId, startTime: start, endTime: end } });
  return toSlot(slot);
}

/**
 * 404 missing, 403 another employer's, 409 SLOT_BOOKED if booked. The slot row is locked for
 * the check-then-delete, and booking claims the same row, so a slot can't be booked between
 * the check and the delete.
 */
export async function deleteSlot(deps: SchedulingDeps, employerId: string, slotId: string): Promise<void> {
  await deps.prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ employer_id: string; is_booked: boolean }[]>`
      SELECT employer_id, is_booked FROM availability_slots WHERE id = ${slotId}::uuid FOR UPDATE`;
    const slot = rows[0];
    if (!slot) throw notFound('Slot not found');
    if (slot.employer_id !== employerId) throw forbidden('You do not own this slot');
    const linked = await tx.application.count({ where: { interviewSlotId: slotId } });
    if (slot.is_booked || linked > 0) throw conflict('Slot is booked and cannot be deleted', 'SLOT_BOOKED');
    await tx.availabilitySlot.delete({ where: { id: slotId } });
  });
}

/** Loads an application the candidate owns: missing → 404, someone else's → 403. */
async function loadOwnedApplication(
  db: Pick<PrismaClient, 'application'>,
  candidateId: string,
  applicationId: string,
) {
  const app = await db.application.findUnique({
    where: { id: applicationId },
    include: { job: { select: { employerId: true } } },
  });
  if (!app) throw notFound('Application not found');
  if (app.candidateId !== candidateId) throw forbidden('You do not own this application');
  return app;
}

/** Open slots the candidate could book for this application: the job's employer's, unbooked, future. */
export async function listAvailableSlots(
  deps: SchedulingDeps,
  candidateId: string,
  applicationId: string,
): Promise<AvailabilitySlot[]> {
  const app = await loadOwnedApplication(deps.prisma, candidateId, applicationId);
  const slots = await deps.prisma.availabilitySlot.findMany({
    where: { employerId: app.job.employerId, isBooked: false, application: null, startTime: { gt: clock(deps) } },
    orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
  });
  return slots.map(toSlot);
}

export const SLOT_TAKEN_MESSAGE = 'Slot already booked';
export const slotTaken = () => conflict(SLOT_TAKEN_MESSAGE, 'SLOT_TAKEN');

/**
 * FP-SCHED-2 eligibility, pure so it can be unit tested. Ownership of the application is
 * checked before this. Returns the error to throw, or null when the booking may proceed.
 */
export function bookingError(args: {
  application: { status: string; interviewSlotId: string | null };
  jobEmployerId: string;
  slot: { employerId: string; startTime: Date; isBooked: boolean; linkedApplicationId: string | null } | null;
  now: Date;
}): HttpError | null {
  const { application, jobEmployerId, slot, now } = args;
  // A slot belonging to a different employer is reported as missing: the candidate has no
  // business knowing it exists.
  if (!slot || slot.employerId !== jobEmployerId) return notFound('Slot not found');
  if (application.status !== 'Interviewing') {
    return conflict('Application is not in Interviewing status', 'NOT_INTERVIEWING');
  }
  if (application.interviewSlotId) return conflict('Application already has an interview booked', 'ALREADY_BOOKED');
  if (slot.isBooked || slot.linkedApplicationId) return slotTaken();
  if (slot.startTime.getTime() <= now.getTime()) return conflict('Slot is in the past', 'SLOT_IN_PAST');
  return null;
}

/**
 * FP-SCHED-3: atomic booking.
 *
 * In one transaction:
 *   1. lock the application row (FOR UPDATE) so one application can't book two slots at once;
 *   2. lock the slot row (FOR UPDATE). Two racing candidates serialize here; the second reads
 *      the slot after the first commits and gets 409 "Slot already booked";
 *   3. check eligibility (bookingError), then claim the slot with a conditional
 *      UPDATE ... WHERE is_booked = false as a second check;
 *   4. link the application. applications.interview_slot_id is UNIQUE, a second line of defense:
 *      a duplicate link fails with P2002, also mapped to 409.
 * Any failure rolls back both rows, so an ineligible booking changes nothing.
 */
export async function bookSlot(
  deps: SchedulingDeps,
  candidateId: string,
  applicationId: string,
  input: unknown,
): Promise<Application> {
  const { slot_id: slotId } = bookInputSchema.parse(input);
  const now = clock(deps);

  try {
    return await deps.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM applications WHERE id = ${applicationId}::uuid FOR UPDATE`;
      const app = await loadOwnedApplication(tx, candidateId, applicationId);

      // Lock the slot too (always application first, then slot, so two bookings can't deadlock).
      // Racing bookers and a concurrent deleteSlot wait here, then read the committed state, so
      // each gets the accurate error: SLOT_TAKEN if it was booked, 404 if it was deleted.
      await tx.$queryRaw`SELECT id FROM availability_slots WHERE id = ${slotId}::uuid FOR UPDATE`;
      const slot = await tx.availabilitySlot.findUnique({
        where: { id: slotId },
        include: { application: { select: { id: true } } },
      });
      const error = bookingError({
        application: app,
        jobEmployerId: app.job.employerId,
        slot: slot && { ...slot, linkedApplicationId: slot.application?.id ?? null },
        now,
      });
      if (error) throw error;

      const claimed = await tx.availabilitySlot.updateMany({
        where: { id: slotId, employerId: app.job.employerId, isBooked: false, startTime: { gt: now } },
        data: { isBooked: true },
      });
      if (claimed.count !== 1) throw slotTaken();

      const updated = await tx.application.update({
        where: { id: applicationId },
        data: { interviewSlotId: slotId },
      });
      return toApplication(updated);
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw slotTaken();
    throw err;
  }
}

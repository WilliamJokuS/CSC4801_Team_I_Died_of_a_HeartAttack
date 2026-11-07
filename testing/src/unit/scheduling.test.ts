import { beforeEach, describe, expect, it } from 'vitest';
import { setStatus } from '../../../backend/src/applications/service.js';
import {
  SLOT_TAKEN_MESSAGE,
  bookSlot,
  bookingError,
  createSlot,
  deleteSlot,
  listAvailableSlots,
  listMySlots,
  validateSlotTimes,
} from '../../../backend/src/scheduling/service.js';
import { MISSING_ID } from '../support/server.js';
import { expectHttpError, expectValidationError } from '../support/assertions.js';
import { FakePrisma, uniqueViolation } from '../support/fakePrisma.js';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const minutes = (n: number) => n * 60_000;
const at = (offsetMinutes: number) => new Date(NOW.getTime() + minutes(offsetMinutes));
const iso = (d: Date) => d.toISOString();

describe('FP-SCHED-1 validateSlotTimes (pure)', () => {
  it('accepts a future slot of exactly 30 minutes', () => {
    expect(validateSlotTimes(at(60), at(90), NOW)).toBeNull();
  });

  it('rejects end before start', () => {
    expect(validateSlotTimes(at(90), at(60), NOW)).toBe('end_time must be after start_time');
  });

  it('rejects end equal to start', () => {
    expect(validateSlotTimes(at(60), at(60), NOW)).toBe('end_time must be after start_time');
  });

  it.each([1, 15, 29, 31, 45, 60, 120])('rejects a %i minute duration (must be exactly 30)', (len) => {
    expect(validateSlotTimes(at(60), at(60 + len), NOW)).toBe('slot must be exactly 30 minutes');
  });

  it('rejects a slot that starts in the past', () => {
    expect(validateSlotTimes(at(-60), at(-30), NOW)).toBe('start_time must be in the future');
  });

  it('rejects a slot that starts exactly now (must be strictly in the future)', () => {
    expect(validateSlotTimes(at(0), at(30), NOW)).toBe('start_time must be in the future');
  });

  it('accepts a slot one millisecond in the future', () => {
    const start = new Date(NOW.getTime() + 1);
    expect(validateSlotTimes(start, new Date(start.getTime() + minutes(30)), NOW)).toBeNull();
  });
});

describe('FP-SCHED-1 createSlot / deleteSlot', () => {
  let db: FakePrisma;
  let employer: string;
  let other: string;
  const deps = () => ({ prisma: db.client, now: () => NOW });

  beforeEach(() => {
    db = new FakePrisma();
    employer = db.addUser({ role: 'Employer' });
    other = db.addUser({ role: 'Employer' });
  });

  it('creates a future 30-minute slot owned by the caller, returned as UTC ISO strings', async () => {
    const slot = await createSlot(deps(), employer, { start_time: iso(at(60)), end_time: iso(at(90)) });
    expect(slot.employer_id).toBe(employer);
    expect(slot.is_booked).toBe(false);
    expect(slot.start_time).toBe('2026-06-01T13:00:00.000Z');
    expect(slot.end_time).toBe('2026-06-01T13:30:00.000Z');
    expect(db.slots).toHaveLength(1);
  });

  it('stores an explicit offset as the same instant (unambiguous timezone)', async () => {
    // 21:00+08:00 is 13:00Z
    const slot = await createSlot(deps(), employer, {
      start_time: '2026-06-01T21:00:00+08:00',
      end_time: '2026-06-01T21:30:00+08:00',
    });
    expect(slot.start_time).toBe('2026-06-01T13:00:00.000Z');
  });

  it('rejects a timestamp with no Z or offset (ambiguous timezone) and creates nothing', async () => {
    await expectValidationError(
      createSlot(deps(), employer, { start_time: '2026-06-01T13:00:00', end_time: '2026-06-01T13:30:00' }),
    );
    expect(db.slots).toHaveLength(0);
  });

  it('rejects missing fields', async () => {
    await expectValidationError(createSlot(deps(), employer, { start_time: iso(at(60)) }));
    await expectValidationError(createSlot(deps(), employer, undefined));
  });

  it.each([
    ['end before start', () => ({ start_time: iso(at(90)), end_time: iso(at(60)) })],
    ['wrong duration', () => ({ start_time: iso(at(60)), end_time: iso(at(120)) })],
    ['in the past', () => ({ start_time: iso(at(-60)), end_time: iso(at(-30)) })],
  ])('rejects %s with 400 VALIDATION_ERROR and creates nothing', async (_name, body) => {
    await expectHttpError(createSlot(deps(), employer, body()), 400, 'VALIDATION_ERROR');
    expect(db.slots).toHaveLength(0);
  });

  it('deletes the caller\'s own unbooked slot', async () => {
    const slotId = db.addSlot({ employerId: employer, start: at(60) });
    await deleteSlot(deps(), employer, slotId);
    expect(db.slots).toHaveLength(0);
  });

  it('refuses to delete a booked slot with 409 SLOT_BOOKED and leaves it in place', async () => {
    const candidate = db.addUser({ role: 'Candidate' });
    const job = db.addJob({ employerId: employer });
    const slotId = db.addSlot({ employerId: employer, start: at(60), isBooked: true });
    db.addApplication({ jobId: job, candidateId: candidate, status: 'Interviewing', interviewSlotId: slotId });
    const before = db.snapshot();
    await expectHttpError(deleteSlot(deps(), employer, slotId), 409, 'SLOT_BOOKED');
    expect(db.snapshot()).toBe(before);
  });

  it('also refuses when an application is linked even if is_booked drifted to false', async () => {
    const candidate = db.addUser({ role: 'Candidate' });
    const job = db.addJob({ employerId: employer });
    const slotId = db.addSlot({ employerId: employer, start: at(60), isBooked: false });
    db.addApplication({ jobId: job, candidateId: candidate, status: 'Interviewing', interviewSlotId: slotId });
    await expectHttpError(deleteSlot(deps(), employer, slotId), 409, 'SLOT_BOOKED');
    expect(db.slots).toHaveLength(1);
  });

  it('returns 403 when deleting another employer\'s slot, and 404 for a missing slot', async () => {
    const slotId = db.addSlot({ employerId: other, start: at(60) });
    await expectHttpError(deleteSlot(deps(), employer, slotId), 403, 'FORBIDDEN');
    expect(db.slots).toHaveLength(1);
    await expectHttpError(deleteSlot(deps(), employer, MISSING_ID), 404, 'NOT_FOUND');
  });
});

describe('FP-SCHED-1 booked slots are never shown as available', () => {
  let db: FakePrisma;
  let employer: string;
  let candidate: string;
  let applicationId: string;
  const deps = () => ({ prisma: db.client, now: () => NOW });

  beforeEach(() => {
    db = new FakePrisma();
    employer = db.addUser({ role: 'Employer' });
    candidate = db.addUser({ role: 'Candidate' });
    const job = db.addJob({ employerId: employer });
    applicationId = db.addApplication({ jobId: job, candidateId: candidate, status: 'Interviewing' });
  });

  it('lists only the job employer\'s unbooked, future slots, earliest first', async () => {
    const later = db.addSlot({ employerId: employer, start: at(180) });
    const sooner = db.addSlot({ employerId: employer, start: at(60) });
    db.addSlot({ employerId: employer, start: at(120), isBooked: true }); // booked
    db.addSlot({ employerId: employer, start: at(-60) }); // past
    db.addSlot({ employerId: db.addUser({ role: 'Employer' }), start: at(90) }); // other employer
    const slots = await listAvailableSlots(deps(), candidate, applicationId);
    expect(slots.map((s) => s.id)).toEqual([sooner, later]);
    expect(slots.every((s) => s.is_booked === false)).toBe(true);
  });

  it('does not list a slot that is linked to another application', async () => {
    const otherCandidate = db.addUser({ role: 'Candidate' });
    const job = db.addJob({ employerId: employer });
    const taken = db.addSlot({ employerId: employer, start: at(60) });
    db.addApplication({ jobId: job, candidateId: otherCandidate, status: 'Interviewing', interviewSlotId: taken });
    expect(await listAvailableSlots(deps(), candidate, applicationId)).toEqual([]);
  });

  it('is 403 for someone else\'s application and 404 for a missing one', async () => {
    const intruder = db.addUser({ role: 'Candidate' });
    await expectHttpError(listAvailableSlots(deps(), intruder, applicationId), 403, 'FORBIDDEN');
    await expectHttpError(listAvailableSlots(deps(), candidate, MISSING_ID), 404, 'NOT_FOUND');
  });

  it('after booking, the slot disappears from the available list', async () => {
    const slotId = db.addSlot({ employerId: employer, start: at(60) });
    expect((await listAvailableSlots(deps(), candidate, applicationId)).map((s) => s.id)).toEqual([slotId]);
    await bookSlot(deps(), candidate, applicationId, { slot_id: slotId });
    expect(await listAvailableSlots(deps(), candidate, applicationId)).toEqual([]);
  });
});

describe('FP-SCHED-2 bookingError eligibility rules (pure)', () => {
  const employerId = 'employer-1';
  const eligible = () => ({
    application: { status: 'Interviewing', interviewSlotId: null as string | null },
    jobEmployerId: employerId,
    slot: {
      employerId,
      startTime: at(60),
      isBooked: false,
      linkedApplicationId: null as string | null,
    },
    now: NOW,
  });

  it('returns null when every rule is satisfied', () => {
    expect(bookingError(eligible())).toBeNull();
  });

  it('reports a missing slot as 404', () => {
    const err = bookingError({ ...eligible(), slot: null });
    expect(err).toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('reports another employer\'s slot as 404 (the candidate must not learn it exists)', () => {
    const args = eligible();
    args.slot.employerId = 'employer-2';
    expect(bookingError(args)).toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it.each(['Pending', 'Rejected', 'Accepted'])('rejects an application in status %s with 409 NOT_INTERVIEWING', (status) => {
    const args = eligible();
    args.application.status = status;
    expect(bookingError(args)).toMatchObject({ status: 409, code: 'NOT_INTERVIEWING' });
  });

  it('rejects an application that already has a booking with 409 ALREADY_BOOKED', () => {
    const args = eligible();
    args.application.interviewSlotId = 'slot-9';
    expect(bookingError(args)).toMatchObject({ status: 409, code: 'ALREADY_BOOKED' });
  });

  it('rejects a booked slot with 409 SLOT_TAKEN and the exact message "Slot already booked"', () => {
    const args = eligible();
    args.slot.isBooked = true;
    expect(bookingError(args)).toMatchObject({ status: 409, code: 'SLOT_TAKEN', message: 'Slot already booked' });
    expect(SLOT_TAKEN_MESSAGE).toBe('Slot already booked');
  });

  it('rejects a slot already linked to an application even if is_booked is false', () => {
    const args = eligible();
    args.slot.linkedApplicationId = 'app-1';
    expect(bookingError(args)).toMatchObject({ status: 409, code: 'SLOT_TAKEN' });
  });

  it('rejects a slot in the past with 409 SLOT_IN_PAST', () => {
    const args = eligible();
    args.slot.startTime = at(-1);
    expect(bookingError(args)).toMatchObject({ status: 409, code: 'SLOT_IN_PAST' });
  });

  it('rejects a slot starting exactly now', () => {
    const args = eligible();
    args.slot.startTime = at(0);
    expect(bookingError(args)).toMatchObject({ status: 409, code: 'SLOT_IN_PAST' });
  });

  it('checks the application status before slot availability', () => {
    const args = eligible();
    args.application.status = 'Pending';
    args.slot.isBooked = true;
    expect(bookingError(args)).toMatchObject({ code: 'NOT_INTERVIEWING' });
  });
});

describe('FP-SCHED-2 bookSlot', () => {
  let db: FakePrisma;
  let employer: string;
  let candidate: string;
  let applicationId: string;
  let jobId: string;
  const deps = () => ({ prisma: db.client, now: () => NOW });

  beforeEach(() => {
    db = new FakePrisma();
    employer = db.addUser({ role: 'Employer' });
    candidate = db.addUser({ role: 'Candidate', displayName: 'Cara Candidate' });
    jobId = db.addJob({ employerId: employer, title: 'Backend Dev' });
    applicationId = db.addApplication({ jobId, candidateId: candidate, status: 'Interviewing' });
  });

  it('links the application to the slot, marks it booked, and returns the updated application', async () => {
    const slotId = db.addSlot({ employerId: employer, start: at(60) });
    const app = await bookSlot(deps(), candidate, applicationId, { slot_id: slotId });
    expect(app.id).toBe(applicationId);
    expect(app.interview_slot_id).toBe(slotId);
    expect(db.slots[0].isBooked).toBe(true);
    expect(db.applications[0].interviewSlotId).toBe(slotId);
  });

  it('makes the booking visible to the owning employer (job, candidate name, no email)', async () => {
    const slotId = db.addSlot({ employerId: employer, start: at(60) });
    await bookSlot(deps(), candidate, applicationId, { slot_id: slotId });
    const [slot] = await listMySlots(deps(), employer);
    expect(slot.is_booked).toBe(true);
    expect(slot.booking).toEqual({
      application_id: applicationId,
      job_id: jobId,
      job_title: 'Backend Dev',
      candidate_id: candidate,
      candidate_display_name: 'Cara Candidate',
    });
    expect(JSON.stringify(slot)).not.toContain('@');
  });

  it('is 403 when booking with another candidate\'s application, and nothing changes (FP-SEC-1.3)', async () => {
    const intruder = db.addUser({ role: 'Candidate' });
    const slotId = db.addSlot({ employerId: employer, start: at(60) });
    const before = db.snapshot();
    await expectHttpError(bookSlot(deps(), intruder, applicationId, { slot_id: slotId }), 403, 'FORBIDDEN');
    expect(db.snapshot()).toBe(before);
  });

  it('is 404 for a missing application', async () => {
    const slotId = db.addSlot({ employerId: employer, start: at(60) });
    await expectHttpError(bookSlot(deps(), candidate, MISSING_ID, { slot_id: slotId }), 404, 'NOT_FOUND');
  });

  it('is 404 for a missing slot and for a slot owned by a different employer', async () => {
    await expectHttpError(bookSlot(deps(), candidate, applicationId, { slot_id: MISSING_ID }), 404, 'NOT_FOUND');
    const foreign = db.addSlot({ employerId: db.addUser({ role: 'Employer' }), start: at(60) });
    const before = db.snapshot();
    await expectHttpError(bookSlot(deps(), candidate, applicationId, { slot_id: foreign }), 404, 'NOT_FOUND');
    expect(db.snapshot()).toBe(before);
  });

  it.each(['Pending', 'Rejected', 'Accepted'] as const)(
    'refuses when the application is %s, without changing either record',
    async (status) => {
      db.applications[0].status = status;
      const slotId = db.addSlot({ employerId: employer, start: at(60) });
      const before = db.snapshot();
      await expectHttpError(bookSlot(deps(), candidate, applicationId, { slot_id: slotId }), 409, 'NOT_INTERVIEWING');
      expect(db.snapshot()).toBe(before);
    },
  );

  it('refuses a slot in the past, without changing either record', async () => {
    const slotId = db.addSlot({ employerId: employer, start: at(-30) });
    const before = db.snapshot();
    await expectHttpError(bookSlot(deps(), candidate, applicationId, { slot_id: slotId }), 409, 'SLOT_IN_PAST');
    expect(db.snapshot()).toBe(before);
  });

  it('refuses a second booking for an application that already has one (ALREADY_BOOKED)', async () => {
    const first = db.addSlot({ employerId: employer, start: at(60) });
    const second = db.addSlot({ employerId: employer, start: at(120) });
    await bookSlot(deps(), candidate, applicationId, { slot_id: first });
    await expectHttpError(bookSlot(deps(), candidate, applicationId, { slot_id: second }), 409, 'ALREADY_BOOKED');
    expect(db.slots.find((s) => s.id === second)!.isBooked).toBe(false);
    expect(db.applications[0].interviewSlotId).toBe(first);
  });

  it('refuses an already-booked slot with 409 "Slot already booked"', async () => {
    const slotId = db.addSlot({ employerId: employer, start: at(60), isBooked: true });
    await expectHttpError(bookSlot(deps(), candidate, applicationId, { slot_id: slotId }), 409, 'SLOT_TAKEN', 'Slot already booked');
    expect(db.applications[0].interviewSlotId).toBeNull();
  });

  it('rejects a slot_id that is not a UUID', async () => {
    await expectValidationError(bookSlot(deps(), candidate, applicationId, { slot_id: 'not-a-uuid' }));
    await expectValidationError(bookSlot(deps(), candidate, applicationId, {}));
  });

  it('keeps the booking and the slot unavailable after the application leaves Interviewing', async () => {
    const slotId = db.addSlot({ employerId: employer, start: at(60) });
    await bookSlot(deps(), candidate, applicationId, { slot_id: slotId });
    const updated = await setStatus({ prisma: db.client }, employer, applicationId, { status: 'Rejected' });
    expect(updated.status).toBe('Rejected');
    expect(updated.interview_slot_id).toBe(slotId);
    expect(db.slots[0].isBooked).toBe(true);
    // and the slot is still not offered to anyone else
    const other = db.addUser({ role: 'Candidate' });
    const otherApp = db.addApplication({ jobId, candidateId: other, status: 'Interviewing' });
    expect(await listAvailableSlots(deps(), other, otherApp)).toEqual([]);
  });
});

describe('FP-SCHED-3 booking conflict handling', () => {
  let db: FakePrisma;
  let employer: string;
  let slotId: string;
  let alice: { id: string; app: string };
  let bob: { id: string; app: string };
  const deps = () => ({ prisma: db.client, now: () => NOW });

  beforeEach(() => {
    db = new FakePrisma();
    employer = db.addUser({ role: 'Employer' });
    const job = db.addJob({ employerId: employer });
    slotId = db.addSlot({ employerId: employer, start: at(60) });
    const mk = (name: string) => {
      const id = db.addUser({ role: 'Candidate', displayName: name });
      return { id, app: db.addApplication({ jobId: job, candidateId: id, status: 'Interviewing' }) };
    };
    alice = mk('Alice');
    bob = mk('Bob');
  });

  const linkedTo = (slot: string) => db.applications.filter((a) => a.interviewSlotId === slot);

  it('two eligible candidates race for one slot: exactly one wins, the other gets 409 "Slot already booked"', async () => {
    const results = await Promise.allSettled([
      bookSlot(deps(), alice.id, alice.app, { slot_id: slotId }),
      bookSlot(deps(), bob.id, bob.app, { slot_id: slotId }),
    ]);
    const won = results.filter((r) => r.status === 'fulfilled');
    const lost = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect(lost[0].reason).toMatchObject({ status: 409, code: 'SLOT_TAKEN', message: 'Slot already booked' });
    // the database contains exactly one booking afterwards
    expect(linkedTo(slotId)).toHaveLength(1);
    expect(db.slots[0].isBooked).toBe(true);
  });

  it('the loser\'s application is left untouched', async () => {
    const results = await Promise.allSettled([
      bookSlot(deps(), alice.id, alice.app, { slot_id: slotId }),
      bookSlot(deps(), bob.id, bob.app, { slot_id: slotId }),
    ]);
    const loserApp = results[0].status === 'rejected' ? alice.app : bob.app;
    const row = db.applications.find((a) => a.id === loserApp)!;
    expect(row.interviewSlotId).toBeNull();
    expect(row.status).toBe('Interviewing');
  });

  it('holds with many simultaneous bookers: still exactly one booking', async () => {
    const job = db.jobs[0].id;
    const extra = Array.from({ length: 8 }, (_, i) => {
      const id = db.addUser({ role: 'Candidate', displayName: `C${i}` });
      return { id, app: db.addApplication({ jobId: job, candidateId: id, status: 'Interviewing' }) };
    });
    const everyone = [alice, bob, ...extra];
    const results = await Promise.allSettled(everyone.map((c) => bookSlot(deps(), c.id, c.app, { slot_id: slotId })));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    for (const r of results.filter((x): x is PromiseRejectedResult => x.status === 'rejected')) {
      expect(r.reason).toMatchObject({ status: 409, message: 'Slot already booked' });
    }
    expect(linkedTo(slotId)).toHaveLength(1);
  });

  it('sequential second attempt on the same slot is also 409 "Slot already booked"', async () => {
    await bookSlot(deps(), alice.id, alice.app, { slot_id: slotId });
    await expectHttpError(bookSlot(deps(), bob.id, bob.app, { slot_id: slotId }), 409, 'SLOT_TAKEN', 'Slot already booked');
  });

  it('second line of defence: a stale read that still shows the slot free is stopped by the conditional UPDATE', async () => {
    await bookSlot(deps(), alice.id, alice.app, { slot_id: slotId });
    const realFind = db.availabilitySlot.findUnique;
    // Bob's transaction reads the slot as it was BEFORE Alice committed.
    db.availabilitySlot.findUnique = async (args) => {
      const row = await realFind(args);
      return row && { ...row, isBooked: false, application: null };
    };
    await expectHttpError(bookSlot(deps(), bob.id, bob.app, { slot_id: slotId }), 409, 'SLOT_TAKEN', 'Slot already booked');
    expect(db.applications.find((a) => a.id === bob.app)!.interviewSlotId).toBeNull();
    expect(linkedTo(slotId)).toHaveLength(1);
  });

  it('third line of defence: the UNIQUE(interview_slot_id) violation (P2002) maps to 409 and rolls the slot claim back', async () => {
    db.application.update = async () => {
      throw uniqueViolation('applications_interview_slot_id_key');
    };
    await expectHttpError(bookSlot(deps(), alice.id, alice.app, { slot_id: slotId }), 409, 'SLOT_TAKEN', 'Slot already booked');
    // the claim on the slot was rolled back, so neither record changed
    expect(db.slots[0].isBooked).toBe(false);
    expect(db.applications.find((a) => a.id === alice.app)!.interviewSlotId).toBeNull();
  });

  it('an unexpected database error is not disguised as a conflict, and rolls back', async () => {
    db.application.update = async () => {
      throw new Error('connection lost');
    };
    await expect(bookSlot(deps(), alice.id, alice.app, { slot_id: slotId })).rejects.toThrow('connection lost');
    expect(db.slots[0].isBooked).toBe(false);
  });

  it('booking takes row locks on the application and then the slot, in that order, inside one transaction', async () => {
    await bookSlot(deps(), alice.id, alice.app, { slot_id: slotId });
    const locks = db.rawQueries.filter((q) => q.text.includes('FOR UPDATE')).map((q) => q.text);
    expect(locks).toHaveLength(2);
    expect(locks[0]).toContain('FROM applications');
    expect(locks[1]).toContain('FROM availability_slots');
  });
});

/**
 * In-memory test double for the Prisma client used by backend/src services.
 *
 * Only the real business logic in backend/src is under test; this stands in for PostgreSQL so
 * the unit tests are fast, deterministic and never touch a real (or shared) database
 * (AGENTS.md "Testing rules", FP-SEC-4). It implements exactly the Prisma calls the services
 * make, plus the database behaviours the services rely on:
 *   - UNIQUE constraints (users.email, applications(job_id, candidate_id),
 *     applications.interview_slot_id) raise Prisma's P2002 error,
 *   - $transaction is serialized (what row locks give the real system) and rolls back every
 *     write if the callback throws,
 *   - every $queryRaw call is recorded (text and bound values) for the SQL-injection tests.
 */
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../../../backend/src/generated/prisma/client.js';
import { Prisma } from '../../../backend/src/generated/prisma/client.js';

type Role = 'Candidate' | 'Employer';
type Status = 'Pending' | 'Interviewing' | 'Rejected' | 'Accepted';

interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  displayName: string;
  createdAt: Date;
}
interface CandidateProfileRow {
  userId: string;
  skills: string[];
  resumeText: string;
}
interface CompanyProfileRow {
  userId: string;
  companyName: string;
  description: string;
}
interface JobRow {
  id: string;
  employerId: string;
  title: string;
  description: string;
  requiredSkills: string[];
  tags: string[];
  isActive: boolean;
  createdAt: Date;
}
interface ApplicationRow {
  id: string;
  jobId: string;
  candidateId: string;
  status: Status;
  createdAt: Date;
  interviewSlotId: string | null;
}
interface SlotRow {
  id: string;
  employerId: string;
  startTime: Date;
  endTime: Date;
  isBooked: boolean;
}

interface Tables {
  users: UserRow[];
  candidateProfiles: CandidateProfileRow[];
  companyProfiles: CompanyProfileRow[];
  jobs: JobRow[];
  applications: ApplicationRow[];
  slots: SlotRow[];
}

export interface RecordedQuery {
  text: string;
  values: unknown[];
}

type Obj = Record<string, any>;

/** P2002, exactly as Prisma reports a violated UNIQUE constraint. */
export function uniqueViolation(target: string): Error {
  return new Prisma.PrismaClientKnownRequestError(`Unique constraint failed on ${target}`, {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target },
  });
}

function pick(row: Obj, select: Obj | undefined): Obj {
  if (!select) return row;
  const out: Obj = {};
  for (const [key, wanted] of Object.entries(select)) if (wanted) out[key] = row[key];
  return out;
}

function matches(row: Obj, where: Obj | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key];
    if (expected === null) return actual === null || actual === undefined;
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if ('gt' in expected) return actual instanceof Date && actual.getTime() > (expected.gt as Date).getTime();
      throw new Error(`fakePrisma: unsupported where operator on "${key}"`);
    }
    return actual === expected;
  });
}

function sortRows<T extends Obj>(rows: T[], orderBy: Obj | Obj[] | undefined): T[] {
  if (!orderBy) return rows;
  const keys = (Array.isArray(orderBy) ? orderBy : [orderBy]).map((o) => Object.entries(o)[0]);
  return [...rows].sort((a, b) => {
    for (const [key, dir] of keys) {
      const av = a[key] instanceof Date ? a[key].getTime() : a[key];
      const bv = b[key] instanceof Date ? b[key].getTime() : b[key];
      if (av === bv) continue;
      const cmp = av < bv ? -1 : 1;
      return dir === 'desc' ? -cmp : cmp;
    }
    return 0;
  });
}

export class FakePrisma {
  private t: Tables = { users: [], candidateProfiles: [], companyProfiles: [], jobs: [], applications: [], slots: [] };
  private lock: Promise<unknown> = Promise.resolve();
  readonly rawQueries: RecordedQuery[] = [];
  /** Every `where` object handed to a model call, for "stays a bound value" assertions. */
  readonly calls: { model: string; method: string; args: Obj }[] = [];

  /** Cast for passing into createApp / the services. */
  get client(): PrismaClient {
    return this as unknown as PrismaClient;
  }

  // ------------------------------------------------------------------ test helpers
  addUser(init: {
    role: Role;
    email?: string;
    displayName?: string;
    passwordHash?: string;
    skills?: string[];
    resumeText?: string;
    companyName?: string;
    description?: string;
  }): string {
    const id = randomUUID();
    const displayName = init.displayName ?? `${init.role} ${id.slice(0, 4)}`;
    this.t.users.push({
      id,
      email: init.email ?? `${id}@test.local`,
      passwordHash: init.passwordHash ?? 'x',
      role: init.role,
      displayName,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    if (init.role === 'Candidate') {
      this.t.candidateProfiles.push({ userId: id, skills: init.skills ?? [], resumeText: init.resumeText ?? '' });
    } else {
      this.t.companyProfiles.push({
        userId: id,
        companyName: init.companyName ?? displayName,
        description: init.description ?? '',
      });
    }
    return id;
  }

  addJob(init: {
    employerId: string;
    title?: string;
    description?: string;
    requiredSkills?: string[];
    tags?: string[];
    isActive?: boolean;
  }): string {
    const id = randomUUID();
    this.t.jobs.push({
      id,
      employerId: init.employerId,
      title: init.title ?? 'Job',
      description: init.description ?? 'desc',
      requiredSkills: init.requiredSkills ?? [],
      tags: init.tags ?? [],
      isActive: init.isActive ?? true,
      createdAt: new Date(),
    });
    return id;
  }

  addApplication(init: { jobId: string; candidateId: string; status?: Status; interviewSlotId?: string | null }): string {
    const id = randomUUID();
    this.t.applications.push({
      id,
      jobId: init.jobId,
      candidateId: init.candidateId,
      status: init.status ?? 'Pending',
      createdAt: new Date(),
      interviewSlotId: init.interviewSlotId ?? null,
    });
    return id;
  }

  addSlot(init: { employerId: string; start: Date; isBooked?: boolean }): string {
    const id = randomUUID();
    this.t.slots.push({
      id,
      employerId: init.employerId,
      startTime: init.start,
      endTime: new Date(init.start.getTime() + 30 * 60_000),
      isBooked: init.isBooked ?? false,
    });
    return id;
  }

  // Read-only views used by assertions.
  get users() { return this.t.users; }
  get jobs() { return this.t.jobs; }
  get applications() { return this.t.applications; }
  get slots() { return this.t.slots; }
  get candidateProfiles() { return this.t.candidateProfiles; }
  get companyProfiles() { return this.t.companyProfiles; }
  snapshot(): string {
    return JSON.stringify(this.t);
  }

  private record(model: string, method: string, args: Obj | undefined) {
    this.calls.push({ model, method, args: args ?? {} });
  }

  // ------------------------------------------------------------------ transactions / raw SQL
  $transaction = async <T>(fn: (tx: FakePrisma) => Promise<T>): Promise<T> => {
    const run = this.lock.then(async () => {
      const before = structuredClone(this.t);
      try {
        return await fn(this);
      } catch (err) {
        this.t = before; // roll back every write made inside the transaction
        throw err;
      }
    });
    this.lock = run.catch(() => undefined);
    return run;
  };

  $queryRaw = async (strings: TemplateStringsArray, ...values: unknown[]): Promise<Obj[]> => {
    const text = strings.join('?').replace(/\s+/g, ' ').trim();
    this.rawQueries.push({ text, values });
    if (/^SELECT 1$/.test(text)) return [{ '?column?': 1 }];
    const id = values[0] as string;
    if (text.includes('FROM availability_slots') && text.includes('employer_id, is_booked')) {
      const s = this.t.slots.find((x) => x.id === id);
      return s ? [{ employer_id: s.employerId, is_booked: s.isBooked }] : [];
    }
    if (text.includes('FROM availability_slots')) return this.t.slots.some((x) => x.id === id) ? [{ id }] : [];
    if (text.includes('FROM applications')) return this.t.applications.some((x) => x.id === id) ? [{ id }] : [];
    if (text.includes('FROM jobs')) {
      const activeOnly = text.includes('is_active');
      return this.t.jobs.some((j) => j.id === id && (!activeOnly || j.isActive)) ? [{ id }] : [];
    }
    throw new Error(`fakePrisma: unrecognised raw query: ${text}`);
  };

  // ------------------------------------------------------------------ relations
  private jobWith(job: JobRow, include?: Obj): Obj {
    const out: Obj = { ...job };
    if (include?.employer) {
      const cp = this.t.companyProfiles.find((p) => p.userId === job.employerId);
      out.employer = { companyProfile: cp ? { companyName: cp.companyName, description: cp.description } : null };
    }
    if (include?._count) {
      out._count = { applications: this.t.applications.filter((a) => a.jobId === job.id).length };
    }
    return out;
  }

  private applicationWith(app: ApplicationRow, include?: Obj): Obj {
    const out: Obj = { ...app };
    if (include?.job) {
      const job = this.t.jobs.find((j) => j.id === app.jobId)!;
      out.job = include.job.include ? this.jobWith(job, include.job.include) : pick(job, include.job.select);
    }
    if (include?.candidate) {
      const user = this.t.users.find((u) => u.id === app.candidateId)!;
      const profile = this.t.candidateProfiles.find((p) => p.userId === user.id);
      out.candidate = pick({ ...user, candidateProfile: profile ? { skills: profile.skills } : null }, include.candidate.select);
    }
    if (include?.interviewSlot) {
      out.interviewSlot = this.t.slots.find((s) => s.id === app.interviewSlotId) ?? null;
    }
    return out;
  }

  private slotWith(slot: SlotRow, include?: Obj): Obj {
    const out: Obj = { ...slot };
    const app = this.t.applications.find((a) => a.interviewSlotId === slot.id);
    out.application = app ? pick(this.applicationWith(app, include?.application?.select), include?.application?.select) : null;
    return out;
  }

  /** Rows as the matcher sees them: slots expose `application` so `application: null` filters work. */
  private slotView(slot: SlotRow): Obj {
    const app = this.t.applications.find((a) => a.interviewSlotId === slot.id);
    return { ...slot, application: app ?? null };
  }

  // ------------------------------------------------------------------ models
  user = {
    create: async (args: Obj) => {
      this.record('user', 'create', args);
      const { data, select } = args;
      if (this.t.users.some((u) => u.email === data.email)) throw uniqueViolation('users_email_key');
      const id = this.addUser({
        role: data.role,
        email: data.email,
        displayName: data.displayName,
        passwordHash: data.passwordHash,
        companyName: data.companyProfile?.create?.companyName,
      });
      const row = this.t.users.find((u) => u.id === id)!;
      return pick(row, select);
    },
    findUnique: async (args: Obj) => {
      this.record('user', 'findUnique', args);
      const { where, select } = args;
      const user = this.t.users.find((u) => (where.id ? u.id === where.id : u.email === where.email));
      if (!user) return null;
      const profile = this.t.candidateProfiles.find((p) => p.userId === user.id) ?? null;
      return pick({ ...user, candidateProfile: profile }, select);
    },
    update: async (args: Obj) => {
      this.record('user', 'update', args);
      const { where, data, select } = args;
      const user = this.t.users.find((u) => u.id === where.id);
      if (!user) throw new Error('fakePrisma: user to update not found');
      if (data.displayName !== undefined) user.displayName = data.displayName;
      const upsert = data.candidateProfile?.upsert;
      if (upsert) {
        const existing = this.t.candidateProfiles.find((p) => p.userId === user.id);
        if (existing) Object.assign(existing, upsert.update);
        else this.t.candidateProfiles.push({ userId: user.id, skills: [], resumeText: '', ...upsert.create });
      }
      const profile = this.t.candidateProfiles.find((p) => p.userId === user.id) ?? null;
      return pick({ ...user, candidateProfile: profile }, select);
    },
  };

  candidateProfile = {
    findUnique: async (args: Obj) => {
      this.record('candidateProfile', 'findUnique', args);
      const row = this.t.candidateProfiles.find((p) => p.userId === args.where.userId);
      return row ? pick(row, args.select) : null;
    },
  };

  companyProfile = {
    findUnique: async (args: Obj) => {
      this.record('companyProfile', 'findUnique', args);
      return this.t.companyProfiles.find((p) => p.userId === args.where.userId) ?? null;
    },
    upsert: async (args: Obj) => {
      this.record('companyProfile', 'upsert', args);
      const existing = this.t.companyProfiles.find((p) => p.userId === args.where.userId);
      if (existing) return Object.assign(existing, args.update);
      const created = { ...args.create } as CompanyProfileRow;
      this.t.companyProfiles.push(created);
      return created;
    },
  };

  job = {
    create: async (args: Obj) => {
      this.record('job', 'create', args);
      const id = this.addJob({
        employerId: args.data.employerId,
        title: args.data.title,
        description: args.data.description,
        requiredSkills: args.data.requiredSkills,
        tags: args.data.tags,
      });
      return this.jobWith(this.t.jobs.find((j) => j.id === id)!, args.include);
    },
    findFirst: async (args: Obj) => {
      this.record('job', 'findFirst', args);
      const row = this.t.jobs.find((j) => matches(j, args.where));
      return row ? this.jobWith(row, args.include) : null;
    },
    findMany: async (args: Obj) => {
      this.record('job', 'findMany', args);
      const rows = sortRows(this.t.jobs.filter((j) => matches(j, args.where)), args.orderBy);
      return rows.map((j) => this.jobWith(j, args.include));
    },
    findUniqueOrThrow: async (args: Obj) => {
      this.record('job', 'findUniqueOrThrow', args);
      const row = this.t.jobs.find((j) => j.id === args.where.id);
      if (!row) throw new Error('fakePrisma: job not found');
      return this.jobWith(row, args.include);
    },
    updateMany: async (args: Obj) => {
      this.record('job', 'updateMany', args);
      const rows = this.t.jobs.filter((j) => matches(j, args.where));
      rows.forEach((j) => Object.assign(j, args.data));
      return { count: rows.length };
    },
    update: async (args: Obj) => {
      this.record('job', 'update', args);
      const row = this.t.jobs.find((j) => j.id === args.where.id);
      if (!row) throw new Error('fakePrisma: job to update not found');
      return Object.assign(row, args.data);
    },
  };

  application = {
    create: async (args: Obj) => {
      this.record('application', 'create', args);
      const { jobId, candidateId } = args.data;
      if (this.t.applications.some((a) => a.jobId === jobId && a.candidateId === candidateId)) {
        throw uniqueViolation('applications_job_id_candidate_id_key');
      }
      const id = this.addApplication({ jobId, candidateId });
      return this.t.applications.find((a) => a.id === id)!;
    },
    findUnique: async (args: Obj) => {
      this.record('application', 'findUnique', args);
      const row = this.t.applications.find((a) => a.id === args.where.id);
      return row ? this.applicationWith(row, args.include) : null;
    },
    findMany: async (args: Obj) => {
      this.record('application', 'findMany', args);
      const rows = sortRows(this.t.applications.filter((a) => matches(a, args.where)), args.orderBy);
      return rows.map((a) => pick(this.applicationWith(a, args.include), args.select));
    },
    count: async (args: Obj) => {
      this.record('application', 'count', args);
      return this.t.applications.filter((a) => matches(a, args.where)).length;
    },
    update: async (args: Obj) => {
      this.record('application', 'update', args);
      const row = this.t.applications.find((a) => a.id === args.where.id);
      if (!row) throw new Error('fakePrisma: application to update not found');
      const slotId = args.data.interviewSlotId;
      if (slotId && this.t.applications.some((a) => a.id !== row.id && a.interviewSlotId === slotId)) {
        throw uniqueViolation('applications_interview_slot_id_key');
      }
      return Object.assign(row, args.data);
    },
  };

  availabilitySlot = {
    create: async (args: Obj) => {
      this.record('availabilitySlot', 'create', args);
      const { employerId, startTime, endTime } = args.data;
      const id = this.addSlot({ employerId, start: startTime });
      const row = this.t.slots.find((s) => s.id === id)!;
      row.endTime = endTime;
      return row;
    },
    findMany: async (args: Obj) => {
      this.record('availabilitySlot', 'findMany', args);
      const rows = sortRows(this.t.slots.filter((s) => matches(this.slotView(s), args.where)), args.orderBy);
      return rows.map((s) => (args.include ? this.slotWith(s, args.include) : s));
    },
    findUnique: async (args: Obj) => {
      this.record('availabilitySlot', 'findUnique', args);
      const row = this.t.slots.find((s) => s.id === args.where.id);
      return row ? (args.include ? this.slotWith(row, args.include) : row) : null;
    },
    updateMany: async (args: Obj) => {
      this.record('availabilitySlot', 'updateMany', args);
      const rows = this.t.slots.filter((s) => matches(s, args.where));
      rows.forEach((s) => Object.assign(s, args.data));
      return { count: rows.length };
    },
    delete: async (args: Obj) => {
      this.record('availabilitySlot', 'delete', args);
      this.t.slots = this.t.slots.filter((s) => s.id !== args.where.id);
    },
  };
}

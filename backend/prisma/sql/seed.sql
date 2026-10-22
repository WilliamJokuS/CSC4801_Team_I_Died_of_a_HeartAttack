-- Deterministic demo data (FP-DOC-3). Expects an empty database: run reset.sql first,
-- or use `npx prisma db seed`, which runs both.
--
-- LOCAL / DEMO CREDENTIALS ONLY. Every account's password is `password123`; the hash below is
-- bcrypt cost 12, the same scheme src/auth/password.ts uses, so these accounts log in normally.
--
-- Fixed UUIDs and timestamps keep every run identical. ID prefixes for readability:
--   1111… candidates   2222… employers   3333… jobs   4444… slots   5555… applications
-- Skills are stored already normalized (trimmed, lowercase, deduped), as the API stores them.
-- Job tags (specs/004) keep their casing and never affect the match score.
-- Interview slots are in January 2027 (UTC) so they stay in the future for the course.
--
-- FP-DOC-3 / FP-MATCH-1 coverage, all against job "Data Analyst" (required: python, sql):
--   Alice Tan  [python, sql] -> 100     Bob Lim [python] -> 50     Chen Wei [rust] -> 0
--   any candidate vs "Graduate Generalist" (required: none) -> 100
-- Applications cover Pending, Interviewing, Rejected, Accepted. Alice and Bob are both
-- Interviewing for Acme's "Data Analyst" and neither is booked, so they can race for Acme's
-- open slots (FP-SCHED-3). Ethan's application shows an existing booking.

BEGIN;

-- ---------------------------------------------------------------- users
INSERT INTO users (id, email, password_hash, role, display_name, created_at) VALUES
  -- candidates
  ('11111111-0000-4000-8000-000000000001', 'alice@demo.test',  '$2b$12$ReSIS12Lj5xBsW.YZWfHTOL3Qw1sscpqP2.eqoSqEGYt8aKaKJi.m', 'Candidate', 'Alice Tan',     '2026-09-01T00:01:00Z'),
  ('11111111-0000-4000-8000-000000000002', 'bob@demo.test',    '$2b$12$ReSIS12Lj5xBsW.YZWfHTOL3Qw1sscpqP2.eqoSqEGYt8aKaKJi.m', 'Candidate', 'Bob Lim',       '2026-09-01T00:02:00Z'),
  ('11111111-0000-4000-8000-000000000003', 'chen@demo.test',   '$2b$12$ReSIS12Lj5xBsW.YZWfHTOL3Qw1sscpqP2.eqoSqEGYt8aKaKJi.m', 'Candidate', 'Chen Wei',      '2026-09-01T00:03:00Z'),
  ('11111111-0000-4000-8000-000000000004', 'diana@demo.test',  '$2b$12$ReSIS12Lj5xBsW.YZWfHTOL3Qw1sscpqP2.eqoSqEGYt8aKaKJi.m', 'Candidate', 'Diana Wong',    '2026-09-01T00:04:00Z'),
  ('11111111-0000-4000-8000-000000000005', 'ethan@demo.test',  '$2b$12$ReSIS12Lj5xBsW.YZWfHTOL3Qw1sscpqP2.eqoSqEGYt8aKaKJi.m', 'Candidate', 'Ethan Ng',      '2026-09-01T00:05:00Z'),
  ('11111111-0000-4000-8000-000000000006', 'fatima@demo.test', '$2b$12$ReSIS12Lj5xBsW.YZWfHTOL3Qw1sscpqP2.eqoSqEGYt8aKaKJi.m', 'Candidate', 'Fatima Rahman', '2026-09-01T00:06:00Z'),
  ('11111111-0000-4000-8000-000000000007', 'gabriel@demo.test','$2b$12$ReSIS12Lj5xBsW.YZWfHTOL3Qw1sscpqP2.eqoSqEGYt8aKaKJi.m', 'Candidate', 'Gabriel Ho',    '2026-09-01T00:07:00Z'),
  ('11111111-0000-4000-8000-000000000008', 'hannah@demo.test', '$2b$12$ReSIS12Lj5xBsW.YZWfHTOL3Qw1sscpqP2.eqoSqEGYt8aKaKJi.m', 'Candidate', 'Hannah Lee',    '2026-09-01T00:08:00Z'),
  ('11111111-0000-4000-8000-000000000009', 'ivan@demo.test',   '$2b$12$ReSIS12Lj5xBsW.YZWfHTOL3Qw1sscpqP2.eqoSqEGYt8aKaKJi.m', 'Candidate', 'Ivan Koh',      '2026-09-01T00:09:00Z'),
  ('11111111-0000-4000-8000-000000000010', 'julia@demo.test',  '$2b$12$ReSIS12Lj5xBsW.YZWfHTOL3Qw1sscpqP2.eqoSqEGYt8aKaKJi.m', 'Candidate', 'Julia Ong',     '2026-09-01T00:10:00Z'),
  -- employers (recruiters)
  ('22222222-0000-4000-8000-000000000001', 'hr@acme.demo.test',      '$2b$12$ReSIS12Lj5xBsW.YZWfHTOL3Qw1sscpqP2.eqoSqEGYt8aKaKJi.m', 'Employer', 'Acme Recruiter',      '2026-09-01T00:11:00Z'),
  ('22222222-0000-4000-8000-000000000002', 'hr@northwind.demo.test', '$2b$12$ReSIS12Lj5xBsW.YZWfHTOL3Qw1sscpqP2.eqoSqEGYt8aKaKJi.m', 'Employer', 'Northwind Recruiter', '2026-09-01T00:12:00Z'),
  ('22222222-0000-4000-8000-000000000003', 'hr@harbor.demo.test',    '$2b$12$ReSIS12Lj5xBsW.YZWfHTOL3Qw1sscpqP2.eqoSqEGYt8aKaKJi.m', 'Employer', 'Harbor Recruiter',    '2026-09-01T00:13:00Z');

-- ---------------------------------------------------------------- candidate profiles
INSERT INTO candidate_profiles (user_id, skills, resume_text) VALUES
  ('11111111-0000-4000-8000-000000000001', '["python", "sql"]',                                      'Data analyst with 2 years of reporting and SQL experience.'),
  ('11111111-0000-4000-8000-000000000002', '["python"]',                                             'Computer science graduate; Python scripting and automation.'),
  ('11111111-0000-4000-8000-000000000003', '["rust"]',                                               'Systems programmer focused on Rust tooling.'),
  ('11111111-0000-4000-8000-000000000004', '["javascript", "typescript", "react", "css"]',           'Frontend developer building React single-page apps.'),
  ('11111111-0000-4000-8000-000000000005', '["typescript", "react", "node.js", "postgresql", "docker"]', 'Full-stack developer, TypeScript end to end.'),
  ('11111111-0000-4000-8000-000000000006', '["java", "spring", "sql"]',                              'Backend Java developer, Spring Boot services.'),
  ('11111111-0000-4000-8000-000000000007', '["docker", "kubernetes", "aws", "linux", "terraform"]',  'DevOps engineer running Kubernetes on AWS.'),
  ('11111111-0000-4000-8000-000000000008', '["python", "pytorch", "sql"]',                           'Machine learning engineer, model training and deployment.'),
  ('11111111-0000-4000-8000-000000000009', '["c", "c++", "linux", "rust"]',                          'Embedded and low-level systems engineer.'),
  ('11111111-0000-4000-8000-000000000010', '[]',                                                     '');

-- ---------------------------------------------------------------- company profiles
INSERT INTO company_profiles (user_id, company_name, description) VALUES
  ('22222222-0000-4000-8000-000000000001', 'Acme Analytics',     'Data and analytics consultancy.'),
  ('22222222-0000-4000-8000-000000000002', 'Northwind Software', 'Product studio building web and mobile apps.'),
  ('22222222-0000-4000-8000-000000000003', 'Harbor Systems',     'Infrastructure, embedded, and security engineering.');

-- ---------------------------------------------------------------- jobs (5 per employer)
INSERT INTO jobs (id, employer_id, title, description, required_skills, tags, is_active, created_at) VALUES
  -- Acme Analytics
  ('33333333-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000001', 'Data Analyst',        'Build dashboards and SQL reports for clients.',            '["python", "sql"]', '["Full-time", "Hybrid"]',                               true, '2026-09-02T01:00:00Z'),
  ('33333333-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000001', 'Graduate Generalist', 'Rotational graduate role; no prior skills required.',      '[]', '["Full-time", "Graduate", "On-site"]',                                              true, '2026-09-02T02:00:00Z'),
  ('33333333-0000-4000-8000-000000000003', '22222222-0000-4000-8000-000000000001', 'Backend Engineer',    'Python services backed by PostgreSQL, shipped in Docker.',  '["python", "postgresql", "docker"]', '["Full-time", "Remote"]',              true, '2026-09-02T03:00:00Z'),
  ('33333333-0000-4000-8000-000000000004', '22222222-0000-4000-8000-000000000001', 'BI Developer',        'Own the Tableau and Excel reporting stack.',                '["sql", "tableau", "excel"]', '["Contract", "Hybrid"]',                     true, '2026-09-02T04:00:00Z'),
  ('33333333-0000-4000-8000-000000000005', '22222222-0000-4000-8000-000000000001', 'ML Engineer',         'Train and deploy PyTorch models.',                          '["python", "pytorch", "sql", "docker"]', '["Full-time", "Senior", "Remote"]',          true, '2026-09-02T05:00:00Z'),
  -- Northwind Software
  ('33333333-0000-4000-8000-000000000006', '22222222-0000-4000-8000-000000000002', 'Frontend Developer',  'Build accessible React interfaces.',                       '["javascript", "typescript", "react", "css"]', '["Full-time", "Remote"]',    true, '2026-09-03T01:00:00Z'),
  ('33333333-0000-4000-8000-000000000007', '22222222-0000-4000-8000-000000000002', 'Full-Stack Developer','TypeScript across React and Node.js with PostgreSQL.',      '["typescript", "react", "node.js", "postgresql"]', '["Full-time", "Hybrid"]', true, '2026-09-03T02:00:00Z'),
  ('33333333-0000-4000-8000-000000000008', '22222222-0000-4000-8000-000000000002', 'Mobile Developer',    'Native Android and iOS apps.',                             '["kotlin", "swift"]', '["Contract", "Remote"]',                             true, '2026-09-03T03:00:00Z'),
  ('33333333-0000-4000-8000-000000000009', '22222222-0000-4000-8000-000000000002', 'QA Engineer',         'Automate browser tests with Selenium and Python.',          '["python", "selenium"]', '["Part-time", "Remote"]',                          true, '2026-09-03T04:00:00Z'),
  ('33333333-0000-4000-8000-000000000010', '22222222-0000-4000-8000-000000000002', 'DevOps Engineer',     'Run our Kubernetes clusters on AWS.',                       '["docker", "kubernetes", "linux", "aws"]', '["Full-time", "Senior", "On-site"]',        true, '2026-09-03T05:00:00Z'),
  -- Harbor Systems
  ('33333333-0000-4000-8000-000000000011', '22222222-0000-4000-8000-000000000003', 'Systems Programmer',  'Performance-critical services in Rust and C++.',            '["rust", "c++", "linux"]', '["Full-time", "Senior", "On-site"]',                        true, '2026-09-04T01:00:00Z'),
  ('33333333-0000-4000-8000-000000000012', '22222222-0000-4000-8000-000000000003', 'Embedded Engineer',   'Firmware for industrial controllers.',                      '["c", "c++"]', '["Full-time", "On-site"]',                                    true, '2026-09-04T02:00:00Z'),
  ('33333333-0000-4000-8000-000000000013', '22222222-0000-4000-8000-000000000003', 'Security Analyst',    'Monitor and harden Linux infrastructure.',                  '["linux", "python", "networking"]', '["Full-time", "Hybrid"]',               true, '2026-09-04T03:00:00Z'),
  ('33333333-0000-4000-8000-000000000014', '22222222-0000-4000-8000-000000000003', 'Cloud Engineer',      'Infrastructure as code on AWS.',                            '["aws", "terraform", "docker"]', '["Contract", "Remote"]',                  true, '2026-09-04T04:00:00Z'),
  ('33333333-0000-4000-8000-000000000015', '22222222-0000-4000-8000-000000000003', 'Java Developer',      'Spring services for internal tooling.',                     '["java", "spring", "sql"]', '["Internship", "On-site"]',                       true, '2026-09-04T05:00:00Z');

-- ---------------------------------------------------------------- availability slots (30 min, UTC)
INSERT INTO availability_slots (id, employer_id, start_time, end_time, is_booked) VALUES
  -- Acme: open slots Alice and Bob can both try to book
  ('44444444-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000001', '2027-01-11T02:00:00Z', '2027-01-11T02:30:00Z', false),
  ('44444444-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000001', '2027-01-11T02:30:00Z', '2027-01-11T03:00:00Z', false),
  -- Northwind: one booked (by Ethan below), one open
  ('44444444-0000-4000-8000-000000000003', '22222222-0000-4000-8000-000000000002', '2027-01-12T06:00:00Z', '2027-01-12T06:30:00Z', true),
  ('44444444-0000-4000-8000-000000000004', '22222222-0000-4000-8000-000000000002', '2027-01-12T06:30:00Z', '2027-01-12T07:00:00Z', false),
  -- Harbor: open
  ('44444444-0000-4000-8000-000000000005', '22222222-0000-4000-8000-000000000003', '2027-01-13T01:00:00Z', '2027-01-13T01:30:00Z', false);

-- ---------------------------------------------------------------- applications
INSERT INTO applications (id, job_id, candidate_id, status, created_at, interview_slot_id) VALUES
  -- Acme / Data Analyst: the matching examples and the booking race
  ('55555555-0000-4000-8000-000000000001', '33333333-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', 'Interviewing', '2026-09-05T01:00:00Z', NULL),
  ('55555555-0000-4000-8000-000000000002', '33333333-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000002', 'Interviewing', '2026-09-05T02:00:00Z', NULL),
  ('55555555-0000-4000-8000-000000000003', '33333333-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000003', 'Rejected',     '2026-09-05T03:00:00Z', NULL),
  -- Acme / ML Engineer
  ('55555555-0000-4000-8000-000000000004', '33333333-0000-4000-8000-000000000005', '11111111-0000-4000-8000-000000000008', 'Accepted',     '2026-09-05T04:00:00Z', NULL),
  -- Northwind
  ('55555555-0000-4000-8000-000000000005', '33333333-0000-4000-8000-000000000006', '11111111-0000-4000-8000-000000000004', 'Pending',      '2026-09-05T05:00:00Z', NULL),
  ('55555555-0000-4000-8000-000000000006', '33333333-0000-4000-8000-000000000007', '11111111-0000-4000-8000-000000000005', 'Interviewing', '2026-09-05T06:00:00Z', '44444444-0000-4000-8000-000000000003'),
  ('55555555-0000-4000-8000-000000000007', '33333333-0000-4000-8000-000000000010', '11111111-0000-4000-8000-000000000007', 'Pending',      '2026-09-05T07:00:00Z', NULL),
  -- Harbor
  ('55555555-0000-4000-8000-000000000008', '33333333-0000-4000-8000-000000000015', '11111111-0000-4000-8000-000000000006', 'Pending',      '2026-09-05T08:00:00Z', NULL),
  ('55555555-0000-4000-8000-000000000009', '33333333-0000-4000-8000-000000000011', '11111111-0000-4000-8000-000000000009', 'Interviewing', '2026-09-05T09:00:00Z', NULL);

COMMIT;

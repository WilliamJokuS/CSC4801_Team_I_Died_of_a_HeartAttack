# Frontend Design Specification

This document defines the complete browser-based frontend for the recruiting and candidate matching platform. Every component, layout, and interaction is specified below so the frontend can be implemented, reviewed, and edited section by section.

---

## 1. Architecture Overview

| Aspect | Decision |
|--------|----------|
| Framework | React 18 + TypeScript |
| Routing | React Router v6 |
| State management | Server state: TanStack Query. Local UI state: React `useState`/`useReducer` |
| Styling | Tailwind CSS |
| API client | Fetch wrapper with session cookie auth |
| Rendering | SPA, client-side rendered |
| Deployment | Static assets served by the backend or a reverse proxy |

### Directory Structure

```
frontend/
├── src/
│   ├── api/              # API client functions and types
│   ├── components/       # Shared, reusable UI components
│   ├── features/        # Role-specific feature modules
│   │   ├── auth/
│   │   ├── candidate/
│   │   └── employer/
│   ├── hooks/           # Custom React hooks
│   ├── layouts/         # Page layout wrappers
│   ├── lib/             # Utilities, constants, validation
│   ├── pages/           # Route components
│   ├── types/           # Shared TypeScript types
│   ├── App.tsx
│   └── main.tsx
├── public/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── vite.config.ts
```

---

## 2. Design System

### 2.1 Color Palette

Use CSS custom properties for theme tokens so the palette can be changed centrally.

```css
:root {
  --color-background: #ffffff;
  --color-surface: #f8fafc;
  --color-border: #e2e8f0;
  --color-text-primary: #1e293b;
  --color-text-secondary: #64748b;
  --color-accent: #2563eb;
  --color-accent-hover: #1d4ed8;
  --color-success: #16a34a;
  --color-warning: #d97706;
  --color-danger: #dc2626;
  --color-danger-bg: #fef2f2;
  --color-info-bg: #eff6ff;
  --color-interviewing: #7c3aed;
  --color-accepted: #16a34a;
  --color-rejected: #dc2626;
  --color-pending: #d97706;
}
```

### 2.2 Typography

| Token | Font | Weight | Size |
|-------|------|--------|------|
| Heading 1 | Inter | 700 | 2rem |
| Heading 2 | Inter | 600 | 1.5rem |
| Heading 3 | Inter | 600 | 1.25rem |
| Body | Inter | 400 | 1rem |
| Caption | Inter | 400 | 0.875rem |
| Button | Inter | 500 | 0.875rem |

### 2.3 Spacing Scale

Use Tailwind's default spacing scale. Common patterns:

- Page padding: `px-4 py-6` (mobile), `px-8 py-10` (desktop)
- Card padding: `p-4` or `p-6`
- Gap between cards: `gap-4`
- Gap between form fields: `gap-5`

### 2.4 Border Radius

| Element | Radius |
|---------|--------|
| Cards | `rounded-lg` (8px) |
| Buttons | `rounded-md` (6px) |
| Inputs | `rounded-md` (6px) |
| Badges | `rounded-full` |

---

## 3. Shared Components

### 3.1 `Button`

```
Props:
  variant: 'primary' | 'secondary' | 'danger' | 'ghost'
  size: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  onClick: () => void
  children: React.ReactNode
```

| Variant | Background | Text | Border |
---------|------------|------|--------|
| primary | `--color-accent` | white | none |
| secondary | transparent | `--color-text-primary` | `--color-border` |
| danger | `--color-danger` | white | none |
| ghost | transparent | `--color-accent` | none |

Behavior:
- `loading` shows a spinner and disables the button.
- `disabled` reduces opacity and blocks clicks.
- Focus ring: 2px outline in `--color-accent`.

### 3.2 `Input`

```
Props:
  label: string
  name: string
  type?: 'text' | 'email' | 'password' | 'textarea' | 'datetime-local'
  value: string
  onChange: (value: string) => void
  error?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
```

Behavior:
- Label always visible above the input.
- Error text below the input in `--color-danger`.
- Password inputs have a show/hide toggle.
- Textarea for resume and job description fields, min-height 8rem.

### 3.3 `SkillTagInput`

Purpose: input field for entering and managing a list of skills.

Behavior:
- User types a skill and presses Enter or comma to add it as a tag/chip.
- Each tag has a remove (×) button.
- Tags are visually distinct chips with rounded corners.
- Input normalizes: trims whitespace, converts to lowercase for comparison but displays as typed.
- Empty or duplicate values are silently ignored.

```
Props:
  label: string
  skills: string[]
  onChange: (skills: string[]) => void
  placeholder?: string
```

### 3.4 `MatchScoreBadge`

Displays a numeric match score with a visual indicator.

```
Props:
  score: number  // 0–100
```

Visual:
- Circular badge with score number in the center.
- Color based on score:
  - 80–100: `--color-success`
  - 50–79: `--color-warning`
  - 0–49: `--color-text-secondary`
- Label "Match" below the number.

### 3.5 `ApplicationStatusBadge`

```
Props:
  status: 'Pending' | 'Interviewing' | 'Rejected' | 'Accepted'
```

| Status | Background | Text Color |
|--------|-----------|------------|
| Pending | amber-50 | `--color-pending` |
| Interviewing | violet-50 | `--color-interviewing` |
| Rejected | red-50 | `--color-rejected` |
| Accepted | green-50 | `--color-accepted` |

Renders as a pill-shaped badge. Includes an icon (clock, calendar, x-circle, check-circle) so status is distinguishable without color alone.

### 3.6 `SkillList`

```
Props:
  skills: string[]
  maxVisible?: number  // default 5; shows "+N more" overflow
```

Renders skills as inline chips. Text is always rendered as plain text, never HTML.

### 3.7 `EmptyState`

```
Props:
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
```

Centers content vertically with muted styling.

### 3.8 `ApiErrorNotice`

```
Props:
  error: ApiError
  onRetry?: () => void
```

Behavior by HTTP status:

| Status | UI Response |
|--------|------------|
| 401 | Redirect to `/login` with `?next=` param |
| 403 | Red banner: "You do not have permission to perform this action." |
| 404 | Full-page not-found state |
| 409 | Server-provided message in a warning banner |
| 422/400 | Field-level validation errors from the API |
| 500+ | Generic: "Something went wrong. Please try again." |

### 3.9 `Modal`

```
Props:
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
```

- Overlays the current page with a semi-transparent backdrop.
- Escape key and backdrop click close the modal.
- Focus is trapped inside the modal while open.

### 3.10 `ConfirmDialog`

Wraps `Modal` for destructive actions (delete job, delete slot, logout).

```
Props:
  open: boolean
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
```

Uses a red "danger" variant for the confirm button.

### 3.11 `Tabs`

```
Props:
  tabs: { id: string; label: string; content: React.ReactNode }[]
  activeTab: string
  onChange: (id: string) => void
```

Used on profile pages to switch between sections without navigation.

### 3.12 `Pagination`

```
Props:
  page: number
  totalPages: number
  onPageChange: (page: number) => void
```

Simple prev/next with page indicator. Shown when list exceeds 20 items.

### 3.13 `LoadingSpinner`

Centered spinner shown while data is loading. Uses `aria-busy` for accessibility.

### 3.14 `TimeSlotCard`

```
Props:
  slot: {
    id: string
    startTime: string  // ISO 8601 with timezone
    endTime: string
    isBooked: boolean
  }
  onBook?: () => void
  onDelete?: () => void
```

Displays the date, start time, and end time in the user's local timezone with the UTC offset shown.

---

## 4. Layouts

### 4.1 `PublicLayout`

Used for landing, login, and register pages.

```
+------------------------------------------+
|              Logo (centered)             |
|                                          |
|           [Page content]                |
|                                          |
+------------------------------------------+
```

- Full-height flex container.
- Content centered horizontally and vertically.
- Clean, minimal design.

### 4.2 `CandidateLayout`

Sidebar navigation (desktop) or bottom tab bar (mobile).

```
+--------+------------------------------------------+
| Logo   |  [Page content]                         |
|        |                                          |
| Dashboard  |                                       |
| Profile    |                                       |
| Applications |                                     |
| Interviews |                                       |
|--------+------------------------------------------+
| Logout  |                                          |
+--------+------------------------------------------+
```

Sidebar items:

| Label | Route |
|-------|-------|
| Dashboard | `/candidate/dashboard` |
| Profile | `/candidate/profile` |
| Applications | `/candidate/applications` |
| Interviews | `/candidate/interviews` |
| Logout | action only |

### 4.3 `EmployerLayout`

Same structure as CandidateLayout but with employer-specific navigation.

Sidebar items:

| Label | Route |
|-------|-------|
| Dashboard | `/employer/dashboard` |
| Company Profile | `/employer/company` |
| Job Postings | `/employer/jobs` |
| Logout | action only |

---

## 5. Pages: Public

### 5.1 Landing Page (`/`)

```
+--------------------------------------------------+
|                                                  |
|         Find the right talent.                  |
|         Or the right opportunity.               |
|                                                  |
|    [Create Candidate Account]                   |
|    [Create Employer Account]                    |
|                                                  |
|    Already have an account? [Log in]             |
|                                                  |
+--------------------------------------------------+
```

- Hero text is static.
- Two CTA buttons pre-select the role on the register page.
- Link to login below.

### 5.2 Register Page (`/register`)

Fields:

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| Email | email | Yes | Valid email format |
| Password | password | Yes | Min 8 chars |
| Confirm Password | password | Yes | Matches password |
| Display Name | text | Yes | Non-empty |
| Role | radio | Yes | Exactly: `Candidate` or `Employer` |

Submit button: "Create Account".

On success: redirect to role dashboard.
On error: show inline field errors from API response.

### 5.3 Login Page (`/login`)

Fields:

| Field | Type | Required |
|-------|------|----------|
| Email | email | Yes |
| Password | password | Yes |

Submit button: "Log In".

On success: redirect to role dashboard.
On error: show "Invalid email or password."

---

## 6. Pages: Candidate

### 6.1 Dashboard (`/candidate/dashboard`)

Page title: "Recommended Jobs"

Layout: Single column list of `JobCard` components.

Each `JobCard` shows:

```
+--------------------------------------------------+
| Senior Python Developer            [Match: 85] |
| TechCorp Inc.                                    |
|                                                  |
| Required: Python, SQL, Docker                   |
|                                                  |
| [View Details]  [Apply]                          |
+--------------------------------------------------+
```

Data displayed per card:

| Field | Source | Display |
|-------|--------|---------|
| Title | `job.title` | Heading |
| Company | `job.company_name` | Subheading |
| Required Skills | `job.required_skills` | `SkillList` |
| Match Score | `job.match_score` | `MatchScoreBadge` |
| Description | `job.description` | Shown on expand or modal |
| Applied? | `job.has_applied` | If true, show "Applied" badge and disable Apply button |

Sorting: descending `match_score`, then case-insensitive `title`, then `id`.

Interactions:
- **View Details**: expands the card inline or opens a modal with the full description.
- **Apply**: creates an application. On success, the card shows "Applied" and the Apply button is disabled.

### 6.2 Profile (`/candidate/profile`)

Page title: "My Profile"

Sections:

**Display Name**
- `Input` field, pre-populated.
- "Save" button below.

**Skills**
- `SkillTagInput` component.
- "Save Skills" button below.

**Resume**
- Large `textarea` (min-height: 16rem).
- "Save Resume" button below.
- Privacy note: "Only you can see your resume."

All three sections can be saved independently. Each section shows a success toast or inline message on save.

### 6.3 Applications (`/candidate/applications`)

Page title: "My Applications"

Layout: Table (desktop) or stacked cards (mobile).

Columns:

| Column | Data |
|--------|------|
| Job | `application.job_title` |
| Employer | `application.company_name` |
| Status | `application.status` → `ApplicationStatusBadge` |
| Interview | `application.interview_slot` (formatted datetime or "—") |
| Action | Link to job detail |

Sorting: most recent first (by `created_at` descending). No user-adjustable sort needed.

Empty state: "You haven't applied to any jobs yet." with a link to the dashboard.

### 6.4 Interviews (`/candidate/interviews`)

Page title: "Interview Bookings"

Sections:

**Available Slots**

For each application with status `Interviewing` and no existing booking:

```
Application: Senior Python Developer at TechCorp Inc.

Available times:
  [Mon, Sep 23, 2024 10:00–10:30 UTC] [Book]
  [Mon, Sep 23, 2024 11:00–11:30 UTC] [Book]
```

Only future, unbooked slots are shown.

**Confirmed Bookings**

For each application with a booking:

```
Interview with TechCorp Inc.
  Position: Senior Python Developer
  Date: Mon, Sep 23, 2024
  Time: 10:00–10:30 UTC
```

Interactions:
- Clicking "Book" opens a `ConfirmDialog`.
- On success, the slot moves to "Confirmed Bookings" and disappears from "Available Slots".
- On `409 Conflict`, show "Slot already booked" in a warning banner.

### 6.5 Job Detail (`/candidate/jobs/:jobId`)

Full job description page.

Content:

- Job title.
- Company name.
- Required skills as `SkillList`.
- Full description.
- Match score.
- Apply button (or "Applied" indicator).

---

## 7. Pages: Employer

### 7.1 Dashboard (`/employer/dashboard`)

Summary cards at the top:

| Metric | Description |
|--------|-------------|
| Active Jobs | Count of non-deleted postings |
| Total Applicants | Sum of applications across owned jobs |
| Pending Reviews | Applications with status `Pending` |

Below: list of owned jobs with quick links.

### 7.2 Company Profile (`/employer/company`)

Fields:

| Field | Type | Required |
|-------|------|----------|
| Company Name | text | Yes |
| Description | textarea | Yes |

"Save" button below.

### 7.3 Job Postings (`/employer/jobs`)

Page title: "My Job Postings"

Layout: Table (desktop) or card list (mobile).

Columns:

| Column | Data |
|--------|------|
| Title | `job.title` |
| Required Skills | `job.required_skills` → `SkillList` |
| Applicants | Count of applications |
| Posted | Relative date (e.g., "3 days ago") |
| Actions | View Applicants, Edit, Delete |

"Create New Job" button at the top.

#### Delete Behavior

1. Click "Delete" → opens `ConfirmDialog`.
2. Confirm → API call to `DELETE /api/jobs/:id`.
3. On success (`204`): remove row from list, show success toast.
4. On `409 Conflict`: show error "Cannot delete: this job has applications or interview slots."
5. On `403`: show permission error.

### 7.4 Create/Edit Job (`/employer/jobs/new`, `/employer/jobs/:jobId/edit`)

Fields:

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| Title | text | Yes | Non-empty |
| Description | textarea | Yes | Non-empty |
| Required Skills | `SkillTagInput` | No | May be empty |

"Save" button creates or updates the job.

On success: redirect to `/employer/jobs`.

### 7.5 Applicants (`/employer/jobs/:jobId/applicants`)

Page title: "Applicants — {job.title}"

Layout: Table sorted by match score descending.

Columns:

| Column | Data |
|--------|------|
| Candidate | `applicant.display_name` |
| Skills | `applicant.skills` → `SkillList` |
| Match Score | `applicant.match_score` → `MatchScoreBadge` |
| Status | `applicant.status` → `ApplicationStatusBadge` |
| Interview | `applicant.interview_slot` (formatted datetime or "—") |
| Action | Status dropdown |

Tie-breaker sort: case-insensitive candidate display name, then stable candidate ID.

Status dropdown:

```
Props:
  applicationId: string
  currentStatus: ApplicationStatus
  onChange: (newStatus: ApplicationStatus) => void
```

Options: exactly `Pending`, `Interviewing`, `Rejected`, `Accepted`.

On change: call API to update status. Show success/error toast. Optimistic update is safe here because there is no concurrent booking logic.

### 7.6 Availability (`/employer/jobs/:jobId/availability`)

Page title: "Availability — {job.title}"

Layout: List of `TimeSlotCard` components grouped by date.

**Create Slot Form**

Fields:

| Field | Type | Required |
|-------|------|----------|
| Date | date | Yes |
| Start Time | time | Yes |
| End Time | time (auto-filled to +30min, editable) | Yes |

Validation:

- End time must be exactly 30 minutes after start time.
- Both times must be in the future.
- End time must not be before start time.

"Add Slot" button.

**Slot List**

Each `TimeSlotCard` shows:

```
+--------------------------------------------------+
| Mon, Sep 23, 2024                                |
| 10:00 – 10:30 UTC                                |
|                                                  |
| Status: [Available] or [Booked]                  |
|                                                  |
| [Delete] (only if unbooked)                      |
+--------------------------------------------------+
```

Delete behavior:

1. Click "Delete" → `ConfirmDialog`: "Are you sure you want to delete this availability slot?"
2. Confirm → API call.
3. On success: remove from list.
4. On conflict: show error "Cannot delete: this slot is already booked."

---

## 8. API Client Design

### 8.1 Base Configuration

```
Base URL: /api/v1
Credentials: include (session cookies)
Content-Type: application/json
```

### 8.2 Types

```typescript
type Role = 'Candidate' | 'Employer';

type ApplicationStatus = 'Pending' | 'Interviewing' | 'Rejected' | 'Accepted';

interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  role: Role;
}

interface CandidateProfile {
  user_id: string;
  display_name: string;
  skills: string[];
  resume_text: string;
}

interface CompanyProfile {
  user_id: string;
  company_name: string;
  description: string;
}

interface Job {
  id: string;
  employer_id: string;
  company_name: string;
  title: string;
  description: string;
  required_skills: string[];
  is_active: boolean;
  created_at: string;
}

interface ScoredJob extends Job {
  match_score: number;
  has_applied: boolean;
}

interface Application {
  id: string;
  job_id: string;
  candidate_id: string;
  status: ApplicationStatus;
  created_at: string;
  interview_slot_id: string | null;
}

interface ScoredApplication extends Application {
  candidate_display_name: string;
  candidate_skills: string[];
  match_score: number;
  job_title: string;
  company_name: string;
  interview_slot: {
    start_time: string;
    end_time: string;
  } | null;
}

interface AvailabilitySlot {
  id: string;
  employer_id: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
}
```

### 8.3 Endpoints Used by Frontend

#### Auth

| Method | Path | Used By |
|--------|------|---------|
| `POST` | `/auth/register` | Register page |
| `POST` | `/auth/login` | Login page |
| `POST` | `/auth/logout` | AppShell logout button |
| `GET` | `/auth/me` | Session restore on app load |

#### Candidate Profile

| Method | Path | Used By |
|--------|------|---------|
| `GET` | `/candidate/profile` | Candidate profile page |
| `PUT` | `/candidate/profile` | Candidate profile page |

#### Jobs

| Method | Path | Used By |
|--------|------|---------|
| `GET` | `/jobs` | Candidate dashboard (returns `ScoredJob[]`) |
| `GET` | `/jobs/:jobId` | Job detail page |
| `POST` | `/employer/jobs` | Create job form |
| `PUT` | `/employer/jobs/:jobId` | Edit job form |
| `DELETE` | `/employer/jobs/:jobId` | Delete action on employer jobs page |

#### Applications

| Method | Path | Used By |
|--------|------|---------|
| `POST` | `/jobs/:jobId/apply` | Candidate dashboard apply button |
| `GET` | `/candidate/applications` | Candidate applications page |
| `GET` | `/employer/jobs/:jobId/applicants` | Employer applicants page |
| `PATCH` | `/employer/applications/:id/status` | Employer applicant status dropdown |

#### Scheduling

| Method | Path | Used By |
|--------|------|---------|
| `GET` | `/employer/availability` | Employer availability page |
| `POST` | `/employer/availability` | Create slot form |
| `DELETE` | `/employer/availability/:slotId` | Delete slot action |
| `GET` | `/candidate/available-slots` | Candidate interviews page |
| `POST` | `/candidate/book-slot` | Book slot action |

#### Company Profile

| Method | Path | Used By |
|--------|------|---------|
| `GET` | `/employer/company` | Company profile page |
| `PUT` | `/employer/company` | Company profile page |

---

## 9. State Management

### 9.1 Server State (TanStack Query)

Use query keys that reflect the data's identity:

```typescript
// Example query keys
['currentUser']
['jobs', 'recommended']
['candidateProfile']
['companyProfile']
['applications', 'candidate', candidateId]
['applicants', jobId]
['availability', employerId]
```

Mutations should invalidate the relevant queries on success:

| Action | Invalidate |
|--------|-----------|
| Update profile | `['candidateProfile']`, `['currentUser']` |
| Update company | `['companyProfile']` |
| Create/Update/Delete job | `['jobs']` |
| Apply to job | `['jobs', 'recommended']`, `['applications']` |
| Update application status | `['applicants', jobId]` |
| Book slot | `['availability']`, `['applications']` |
| Create/Delete slot | `['availability']` |

### 9.2 Local UI State

- Modal open/close.
- Form field values and validation errors.
- Active tab.
- Expanded/collapsed card state.

Use `useState` or `useReducer` as appropriate.

---

## 10. Form Validation

Use a lightweight validation approach:

- Client-side validation for immediate feedback.
- Server-side validation is the source of truth.
- Display server validation errors mapped to fields.

### Validation Rules Summary

| Field | Rules |
|-------|-------|
| Email | Valid email format |
| Password | Min 8 chars |
| Confirm Password | Matches password |
| Display Name | Non-empty, trimmed |
| Role | Must be `Candidate` or `Employer` |
| Company Name | Non-empty, trimmed |
| Company Description | Non-empty, trimmed |
| Job Title | Non-empty, trimmed |
| Job Description | Non-empty, trimmed |
| Required Skills | Array of strings; may be empty |
| Skills (candidate) | Array of non-empty strings, trimmed, deduplicated |
| Resume | Non-empty string (may be long) |
| Slot Start | Future datetime |
| Slot End | Exactly 30 minutes after start |

---

## 11. Accessibility

- All interactive elements have accessible names.
- Color is not the only indicator of state (use icons, text, patterns).
- Form fields have associated labels.
- Tables have proper `<th>` and `scope` attributes.
- Modal dialogs trap focus.
- Keyboard navigation works for all interactive elements.
- Contrast ratio meets WCAG 2.1 AA (4.5:1 for normal text, 3:1 for large text).

---

## 12. Responsive Behavior

| Breakpoint | Width | Layout Changes |
|-----------|-------|---------------|
| Mobile | < 640px | Single column, bottom nav for candidates, stacked cards instead of tables |
| Tablet | 640–1024px | Two-column forms, sidebar collapses to icon-only |
| Desktop | > 1024px | Full sidebar, multi-column tables |

---

## 13. Error Boundaries

- Global error boundary catches unhandled errors and shows a friendly message.
- Per-query error boundaries catch API errors on specific data loads.
- Form-level errors are handled inline.

---

## 14. Testing Considerations

- Unit tests for validation logic.
- Component tests for form behavior and error display.
- Integration tests for API mocking and data flow.
- E2E smoke tests for critical paths: register → login → dashboard → apply → view applications.

---

## 15. Review Checklist

Use this checklist when reviewing the frontend implementation:

- [ ] All routes render correctly for both roles.
- [ ] Candidate cannot see employer routes and vice versa.
- [ ] Unauthenticated access redirects to login.
- [ ] Match scores are visible and sorted correctly.
- [ ] Tie-breaking is correct in both candidate and employer views.
- [ ] Apply button is disabled after applying.
- [ ] Status badges show all four states.
- [ ] Availability slots are in the future and 30 minutes long.
- [ ] Booked slots are not shown as available.
- [ ] Booking conflict shows "Slot already booked".
- [ ] Delete job with dependents shows a conflict error.
- [ ] User-generated text is escaped (no raw HTML rendering).
- [ ] No secrets in the UI.
- [ ] Mobile layout is usable.

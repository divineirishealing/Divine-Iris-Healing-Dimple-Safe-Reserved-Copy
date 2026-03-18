# Divine Iris Healing - PRD (Updated Mar 18, 2026)

## What's Built

### Core Platform
- Student Dashboard: Iris flower layout, glassmorphism, Soul Compass, Google OAuth
- Multi-Package Pricing: Versioning, lock/unlock, per-program pricing (Unit/Offer), taxes (GST/VAT)
- Full EMI System: Auto-generate amounts/dates, EMI Day field, late fees, channelization fee
- Payment Flow: 3 methods (Stripe/Exly/Manual), bank accounts CRUD, admin approval for manual
- Admin Mirror View: See exactly what student sees + edit controls

### Program Management
- Global Program Scheduler (Scheduler tab): Set dates once → syncs to all subscribers
- AWRP: Fixed 3rd→30th every month, 10PM IST, Weekends: Offline
- Per-program controls: Pause/Resume, Online/Offline, Visible toggle
- Student dashboard: Sees scheduled dates + picks Online/Offline per month/session
- Schedule editor in subscriber edit form
- **Collapsible Scheduler**: Each program section in admin Scheduler tab is collapsible/expandable

### Phase B Features (Built Mar 18, 2026)
- **Calendar View** (`/dashboard/sessions`): Full monthly calendar with color-coded program sessions (purple=AWRP, amber=MMM, green=QM, blue=BAD), day detail panel, month overview stats
- **Daily Progress Tracking** (`/dashboard/progress`): Students mark daily progress with 5-star rating, notes, calendar grid showing completed/missed days, streak counter
- **Extraordinary Moments**: Students mark special days with is_extraordinary flag, amber-highlighted on calendar, dedicated timeline section
- **Student-Initiated Pause**: Students can pause programs (if admin enables via "Pausable" toggle), with start/end date picker and reason. Resume button appears for paused programs
- **Admin Allow Pause Toggle**: "Pausable" checkbox per program in subscriber edit form (SubscribersTab)
- **Sidebar Updated**: Added "My Calendar" and "Daily Progress" navigation items

### NEXT TO BUILD
- **Admin Preview as Student** — Admin views dashboard as specific student
- **Wire Stripe & Exly EMI Payments** — Automate payment status updates
- **Upcoming Programs on Student Dashboard** — Programs with subscriber-only pricing
- **Family Member Signup & Referral System**

### Future/Backlog
- Growth Roadmap & Mini Diary sub-pages
- Backend RBAC middleware
- Razorpay & WhatsApp automation
- Refactor SubscribersTab.jsx (1270+ lines → smaller components)

## Key Files
- `frontend/src/components/admin/tabs/SchedulerTab.jsx` (collapsible)
- `frontend/src/components/admin/tabs/SubscribersTab.jsx` (allow_pause toggle)
- `frontend/src/components/dashboard/CalendarPage.jsx` (NEW)
- `frontend/src/components/dashboard/ProgressPage.jsx` (NEW)
- `frontend/src/components/dashboard/FinancialsPage.jsx` (pause/resume buttons)
- `frontend/src/components/dashboard/Sidebar.jsx` (updated nav)
- `frontend/src/pages/StudentDashboard.jsx`
- `backend/routes/student.py` (daily-progress, pause/resume endpoints)
- `backend/routes/subscribers.py` (ProgramDetail with allow_pause)
- `backend/routes/emi_payments.py`

## Key API Endpoints
- `GET /api/student/home` — Student dashboard data
- `POST /api/student/daily-progress` — Save daily progress
- `GET /api/student/daily-progress?month=YYYY-MM` — Get progress entries
- `GET /api/student/extraordinary-moments` — Get extraordinary moments
- `POST /api/student/pause-program` — Student pauses a program
- `POST /api/student/resume-program-simple` — Student resumes a program
- `POST /api/student/choose-mode` — Online/Offline mode choice
- `GET /api/admin/subscribers/program-schedule` — Global schedule
- `PUT /api/admin/subscribers/program-schedule` — Save & sync schedule

## DB Collections
- `clients` — Main subscriber data (subscription.programs_detail has allow_pause, pause_start, pause_end)
- `daily_progress` — Daily progress entries (client_id, date, program_name, rating, is_extraordinary)
- `annual_packages` — Pricing packages
- `program_schedule` — Global program schedule
- `emi_payments` — Manual payment submissions

## Known Issues
- P2: End date browser display bug (suspected browser caching)
- P3: Duplicated create_checkout_no_adaptive backend function

## Admin: /admin (admin / divineadmin2024)
## Student: /login → /dashboard
## Test: Priya Sharma (test@divineiris.com, session: test-session-token-for-ui-verification)

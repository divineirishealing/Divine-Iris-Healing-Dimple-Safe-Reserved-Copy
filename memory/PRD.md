# Divine Iris Healing - PRD (Updated Mar 19, 2026)

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
- **Calendar View** (`/dashboard/sessions`): Full monthly calendar with color-coded program sessions
- **Daily Progress Tracking** (`/dashboard/progress`): Star ratings, notes, streak counter
- **Extraordinary Moments**: Amber-highlighted special days with dedicated timeline
- **Student-Initiated Pause**: Pause/resume with start/end dates, admin toggle per program
- **Admin Allow Pause Toggle**: "Pausable" checkbox per program in subscriber edit form

### Homepage & Enrollment Enhancements (Built Mar 19, 2026)
- **FOMO Rotating Subtitle**: Upcoming Programs section subtitle cycles through admin-editable messages with fade-in/fade-out animation (e.g., "SEATS ARE FILLING FAST", "LIMITED SPOTS REMAINING")
- **Enrollment Urgency Testimonials**: Rotating one-liner testimonial strip on enrollment page. Admin-editable quotes that create urgency & social proof (e.g., "Joining this program was my best decision" — Anita R.)
- Both managed in admin: FOMO subtitles via Homepage Sections → Upcoming, Urgency quotes via Upcoming Hub

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
- `frontend/src/components/UpcomingProgramsSection.jsx` (FOMO subtitle rotator)
- `frontend/src/pages/EnrollmentPage.jsx` (urgency testimonial strip)
- `frontend/src/components/admin/tabs/HomepageSectionsTab.jsx` (FOMO editor)
- `frontend/src/components/admin/tabs/UpcomingHubTab.jsx` (urgency quotes editor)
- `frontend/src/components/admin/tabs/SchedulerTab.jsx` (collapsible)
- `frontend/src/components/dashboard/CalendarPage.jsx`
- `frontend/src/components/dashboard/ProgressPage.jsx`
- `frontend/src/components/dashboard/FinancialsPage.jsx`
- `backend/routes/student.py` (daily-progress, pause/resume endpoints)
- `backend/routes/subscribers.py` (ProgramDetail with allow_pause)
- `backend/models.py` (enrollment_urgency_quotes in SiteSettings)

## Key API Endpoints
- `GET /api/settings` — Returns all site settings (includes enrollment_urgency_quotes, homepage_sections with fomo_subtitles)
- `PUT /api/settings` — Updates site settings
- `GET /api/student/home` — Student dashboard data
- `POST /api/student/daily-progress` — Save daily progress
- `GET /api/student/daily-progress?month=YYYY-MM` — Get progress entries
- `GET /api/student/extraordinary-moments` — Get extraordinary moments
- `POST /api/student/pause-program` — Student pauses a program
- `POST /api/student/resume-program-simple` — Student resumes a program

## DB Collections
- `site_settings` — Stores enrollment_urgency_quotes and homepage_sections with fomo_subtitles
- `clients` — Main subscriber data
- `daily_progress` — Daily progress entries
- `annual_packages` — Pricing packages
- `program_schedule` — Global program schedule

## Known Issues
- P2: End date browser display bug (suspected browser caching)
- P3: Duplicated create_checkout_no_adaptive backend function

## Admin: /admin (admin / divineadmin2024)
## Student: /login → /dashboard
## Test: Priya Sharma (test@divineiris.com, session: test-session-token-for-ui-verification)

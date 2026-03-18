# Divine Iris Healing - PRD (Updated Mar 18, 2026)

## What's Built This Session

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

### NEXT TO BUILD
- **Collapsible scheduler** in admin (each program section collapses)
- **Calendar view** on student dashboard showing all scheduled sessions
- **Daily progress tracking** — student marks each day's progress
- **Mark for offline sessions** — student opts into offline for specific sessions
- **Extraordinary moments** — student can mark special days/moments during sessions

### Phase B (upcoming)
- Upcoming programs with subscriber-only pricing
- Sign up from dashboard
- Family members + Referral system
- Beautiful dashboard home redesign

## Key Files
- `frontend/src/components/admin/tabs/SchedulerTab.jsx`
- `frontend/src/components/admin/tabs/SubscribersTab.jsx`
- `frontend/src/components/dashboard/FinancialsPage.jsx`
- `frontend/src/pages/StudentDashboard.jsx`
- `backend/routes/subscribers.py`
- `backend/routes/emi_payments.py`
- `backend/routes/student.py`

## Admin: /admin (admin / divineadmin2024)
## Student: /login → /dashboard
## Test: Priya Sharma (test@divineiris.com, session: test-session-22fbe1e5)

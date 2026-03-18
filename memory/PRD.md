# Divine Iris Healing - PRD

## Architecture
React + TailwindCSS + shadcn/ui | FastAPI + Motor MongoDB | Stripe | Emergent Google OAuth

## What's Been Built (Mar 18, 2026)

### Student Dashboard - "Modern Spiritual" 
- Iris flower layout, glassmorphism, purple atmosphere, Soul Compass progress ring
- Google OAuth login (Client Garden whitelist only)
- Video upload in Sanctuary Settings

### Annual Subscriber Management (MAJOR)
- **Multi-Package System**: Multiple pricing packages (PKG-STANDARD, PKG-VIP etc.) with versioning, lock/unlock
- **Per-Program Pricing**: Price/Unit, Offer/Unit, auto-calculated Total, Offer, Discount % per currency (INR/USD/AED)
- **Taxes**: GST 18% (India), VAT 5% (Dubai) auto-calculated
- **Subscriber CRUD**: Create/Edit/Delete with full form, Excel upload/download/export
- **EMI System**: Up to 12 EMIs, auto-generated amounts (Total ÷ count), EMI Day field (set once, all dates auto-populate)
- **EMI #1 offset**: Starts 1 month before batch start date
- **Payment Flow**: 3 methods per subscriber (Stripe/Exly/Manual toggle)
- **Manual Payment**: Student submits with bank details, receipt upload → Admin approves
- **Bank Accounts**: CRUD with unique codes, shown on student payment form
- **Late Fees**: Per-day late fee + channelization fee, auto-calculated on overdue EMIs
- **Show Late Fees toggle**: Per subscriber visibility control
- **Admin Mirror View**: Exact same view as student with edit controls
- **Package Config**: Included programs table with offer/unit pricing, package discount %, validity dates
- **Package Versioning**: Create new version → locks old one

### Student Financials Page
- Top stats: Total Fee, Paid, Remaining, Next Due
- Payment Progress bar
- EMI Schedule: Due Date, Amount, Status (paid/due/overdue/submitted), Late Fee, Ch. Fee, Payment Mode, Remarks, Action (Pay Now / Paid / Receipt)
- EMI Plan label badge (6/12 Month EMI Plan)
- Pay Now modal: Stripe / Exly / Manual with bank details display
- Session Tracking: Current, Yet to Avail, Due
- Programs: Name + duration (months/sessions) + Online badge + Pause/Hidden badges

### Admin Controls for Programs (per subscriber)
- Edit form: Name, Duration, Unit (months/sessions), Online/Offline dropdown, Pause/Resume button, Visible checkbox, Delete
- Expanded row: Read-only view with badges
- "Regenerate All EMIs" button

## NEXT TO BUILD (Phase A - Program Scheduling + Dashboard Redesign)

### What Students Need:
1. **My Programs** — each program shows: name, total months/sessions, completed vs remaining, online/offline choice per month/session
2. **Scheduled Sessions** — when admin sets dates, they appear on student dashboard automatically  
3. **Student chooses Online/Offline** for each scheduled month/session
4. **Upcoming Programs** (from website) with **special annual subscriber pricing**
5. **Sign up from dashboard** for upcoming programs
6. **Family Members** — add spouse/kids
7. **Referral System** — share link, track referrals
8. Beautiful, engaging, warm dashboard experience

### What Admin Needs:
1. Schedule dates/times for MMM, Quarterly Release, Bi-Annual Download sessions
2. When scheduled → auto-appears on student dashboard
3. See student's online/offline choices
4. Preview what student sees

### Data Model for Program Scheduling:
```
programs_detail: [
  { name: "AWRP", duration_value: 12, duration_unit: "months", mode: "online",
    schedule: [
      { month: 1, date: "2026-02-03", end_date: "2026-03-02", mode_choice: "online" },
      { month: 2, date: "2026-03-03", end_date: "2026-03-30", mode_choice: "" },  // student picks
      ...
    ]
  },
  { name: "Quarterly Release", duration_value: 4, duration_unit: "sessions",
    schedule: [
      { session: 1, date: "2026-04-15", time: "7PM IST", mode_choice: "online" },
      { session: 2, date: "", time: "", mode_choice: "" },  // date TBD
      ...
    ]
  }
]
```

## Key Files
- `backend/routes/subscribers.py` — Package CRUD, subscriber CRUD, EMI management
- `backend/routes/emi_payments.py` — Bank accounts, payment submissions, approvals
- `backend/routes/student.py` — Student home API
- `backend/routes/auth.py` — Google OAuth
- `frontend/src/components/admin/tabs/SubscribersTab.jsx` — Main admin UI (packages, subscribers, approvals, banks)
- `frontend/src/components/dashboard/FinancialsPage.jsx` — Student financials + Pay Now
- `frontend/src/pages/StudentDashboard.jsx` — Dashboard home (iris flower layout)
- `frontend/src/layouts/DashboardLayout.jsx` — Dashboard wrapper
- `frontend/src/components/dashboard/Sidebar.jsx` — Navigation

## Admin: /admin (admin / divineadmin2024)
## Student: /login → /dashboard (Google OAuth, Client Garden whitelist)
## Test User: Priya Sharma (test@divineiris.com, session: test-session-22fbe1e5)

# Divine Iris Healing - Product Requirements Document

## Original Problem Statement
Build a pixel-perfect clone of https://divineirishealing.com/ with comprehensive admin panel, evolving into a Multi-Tiered Student Growth Platform with RBAC, advanced analytics, and interactive tools.

## Architecture
- **Frontend**: React + TailwindCSS + shadcn/ui
- **Backend**: FastAPI + Pydantic + Motor (async MongoDB)
- **Database**: MongoDB
- **Payments**: Stripe (TEST MODE)
- **Email**: Google Workspace SMTP
- **Auth**: Emergent-managed Google OAuth (student login)

## Implemented Features

### Annual Subscriber CRUD & Management (Mar 18, 2026) - COMPLETED
- [x] **Create subscriber** form: name, email, program, dates, fee, currency, payment mode, EMIs (up to 12 with schedule), sessions, programs, bi-annual/quarterly
- [x] **Edit subscriber** via pre-filled form from row edit button
- [x] **Quick actions**: Mark EMI as Paid (green checkmark), +1 Session Availed button
- [x] **Excel upload/download**: bulk import, template download, data export
- [x] **EMI tracking**: date, amount, remaining, due date, status per EMI
- [x] **Session tracking**: carry forward, current, total, availed, yet to avail, due, scheduled dates
- [x] **Student Financials page**: top stats, payment progress, EMI table, session ring, programs list
- [x] All 16/16 backend + 100% frontend tests passed (iteration_76)

### Student Dashboard - "Modern Spiritual" (Mar 18, 2026) - COMPLETED
- [x] Iris flower layout, glassmorphism cards, purple atmosphere
- [x] Soul Compass progress ring, tier-based sidebar
- [x] Video upload in Sanctuary Settings

### Google OAuth Authentication (Mar 18, 2026) - COMPLETED
### Previous Features (Mar 16-17, 2026) - COMPLETED

## Key API Endpoints
- `POST /api/admin/subscribers/create` - Create subscriber manually
- `PUT /api/admin/subscribers/update/{id}` - Update subscriber
- `DELETE /api/admin/subscribers/delete/{id}` - Remove subscription
- `POST /api/admin/subscribers/emi-payment` - Record EMI payment
- `POST /api/admin/subscribers/session-update` - Update session count
- `POST /api/admin/subscribers/upload` - Upload Excel
- `GET /api/admin/subscribers/download-template` - Download blank template
- `GET /api/admin/subscribers/export` - Export all subscribers
- `GET /api/admin/subscribers/list` - List subscribers
- `GET /api/student/home` - Student home data

## Upcoming Tasks
- **P0:** Build remaining dashboard sub-pages (Growth Roadmap, Mini Diary, Monthly Reports)
- **P1:** RBAC Middleware (backend route protection by tier)
- **P2:** Admin command center for student tier management

## Future/Backlog
- Razorpay for Indian payments
- Advanced analytics (Past vs Present charts)
- Interactive tools (Calendar sync, Report submission)
- WhatsApp automation, SEO

## Technical Debt
- Deduplicate `create_checkout_no_adaptive` function
- TrustSection.jsx cleanup

## Admin Credentials
- URL: /admin, Username: admin, Password: divineadmin2024

## Student Dashboard Access
- URL: /login → /dashboard
- Auth: Google OAuth (must be in Client Garden)

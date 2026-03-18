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

### Global Annual Pricing Config (Mar 18, 2026) - COMPLETED
- [x] Editable package structure: name, duration (months), pricing per currency (INR/USD/AED/EUR/GBP)
- [x] Included programs with duration units (months/sessions): AWRP 12mo, MMM 6mo, Bi-Annual Downloads 2 sess, Quarterly Meetups 4 sess
- [x] Default session counts (current, carry forward) configurable
- [x] Auto-fill subscriber form: program name, total fee, programs, sessions, bi-annual/quarterly from config
- [x] Start date → End date auto-calculation (+12 months)
- [x] Currency change → Fee auto-update from config pricing
- [x] Edit form preserves existing data (no override)
- [x] All 10/10 backend + 100% frontend tests passed (iteration_77)

### Annual Subscriber CRUD & Management (Mar 18, 2026) - COMPLETED
- [x] Create/Edit/Delete subscriber with full form
- [x] Quick actions: Mark EMI Paid, +1 Session Availed
- [x] Excel upload/download, template, export
- [x] EMI tracking (up to 12), session tracking, multi-program packages
- [x] Student Financials page with EMI schedule, session ring, programs list
- [x] All 16/16 backend + 100% frontend tests (iteration_76)

### Student Dashboard - "Modern Spiritual" (Mar 18, 2026) - COMPLETED
- [x] Iris flower layout, glassmorphism, purple atmosphere, Soul Compass
- [x] Video upload in Sanctuary Settings
- [x] All 8/8 backend + 100% frontend tests (iteration_74)

### Google OAuth Authentication (Mar 18, 2026) - COMPLETED
### Previous Features (Mar 16-17, 2026) - COMPLETED

## Key API Endpoints
- `GET/PUT /api/admin/subscribers/pricing-config` - Global annual package config
- `POST /api/admin/subscribers/create` - Create subscriber
- `PUT /api/admin/subscribers/update/{id}` - Update subscriber
- `POST /api/admin/subscribers/emi-payment` - Record EMI payment
- `POST /api/admin/subscribers/session-update` - Update sessions
- `POST /api/admin/subscribers/upload` - Upload Excel
- `GET /api/admin/subscribers/download-template` / `export` / `list`
- `GET /api/student/home` - Student home data

## Upcoming Tasks
- **P0:** Build remaining dashboard sub-pages (Growth Roadmap, Mini Diary, Monthly Reports)
- **P1:** RBAC Middleware (backend route protection by tier)
- **P2:** Admin command center for student tier management

## Future/Backlog
- Razorpay for Indian payments
- Advanced analytics, Calendar sync, WhatsApp automation, SEO

## Admin Credentials
- URL: /admin, Username: admin, Password: divineadmin2024

## Student Dashboard Access
- URL: /login → /dashboard, Auth: Google OAuth (Client Garden whitelist)

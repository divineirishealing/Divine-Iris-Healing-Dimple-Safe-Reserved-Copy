# Divine Iris Healing - Product Requirements Document

## Original Problem Statement
Build a pixel-perfect clone of https://divineirishealing.com/ with comprehensive admin panel, evolving into a Multi-Tiered Student Growth Platform.

## Architecture
- **Frontend**: React + TailwindCSS + shadcn/ui
- **Backend**: FastAPI + Pydantic + Motor (async MongoDB)
- **Database**: MongoDB
- **Payments**: Stripe (TEST MODE), **Auth**: Emergent Google OAuth

## Implemented Features

### Global Annual Pricing Structure (Mar 18, 2026) - COMPLETED
- [x] Pulls monthly prices from existing programs in Pricing Hub via fuzzy matching
- [x] Editable programs table: name, duration, unit (months/sessions), Source Tier (1 Month/3 Months/Annual), Discount %
- [x] Calculate Pricing button: shows breakdown (monthly × duration - discount per program)
- [x] Subtotals, overall discount %, and final Annual Package Price per currency
- [x] "Apply to Package Price" button auto-fills final pricing fields
- [x] Manual price override always available
- [x] All 18/18 backend + 100% frontend tests passed (iteration_78)

### Annual Subscriber CRUD & Management (Mar 18, 2026) - COMPLETED
- [x] Create/Edit/Delete subscriber with full form, Quick actions (Mark EMI Paid, +1 Session)
- [x] Auto-fill from config: start date → end date (+12mo), fee, programs, sessions
- [x] Excel upload/download/export, EMI tracking (up to 12), session tracking
- [x] Student Financials page with EMI schedule, session ring, programs list

### Student Dashboard - "Modern Spiritual" (Mar 18, 2026) - COMPLETED
- [x] Iris flower layout, glassmorphism, purple atmosphere, Soul Compass, video upload

### Google OAuth + Previous Features - COMPLETED

## Key API Endpoints
- `GET /api/admin/subscribers/calculate-pricing` - Calculate from program prices
- `GET/PUT /api/admin/subscribers/pricing-config` - Global package config
- `POST /api/admin/subscribers/create` | `PUT .../update/{id}` | `DELETE .../delete/{id}`
- `POST /api/admin/subscribers/emi-payment` | `POST .../session-update`
- `POST /api/admin/subscribers/upload` | `GET .../download-template` | `GET .../export`
- `GET /api/student/home` - Student dashboard data

## Upcoming Tasks
- **P0:** Build remaining dashboard sub-pages (Growth Roadmap, Mini Diary, Monthly Reports)
- **P1:** RBAC Middleware (backend route protection by tier)

## Future/Backlog
- Razorpay, Advanced analytics, Calendar sync, WhatsApp automation, SEO

## Admin: /admin (admin / divineadmin2024) | Student: /login → /dashboard (Google OAuth)

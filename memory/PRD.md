# Divine Iris Healing - Product Requirements Document

## Original Problem Statement
Build a pixel-perfect clone of https://divineirishealing.com/ with comprehensive admin panel, evolving into a Multi-Tiered Student Growth Platform.

## Architecture
- **Frontend**: React + TailwindCSS + shadcn/ui
- **Backend**: FastAPI + Pydantic + Motor (async MongoDB)
- **Database**: MongoDB
- **Payments**: Stripe (TEST MODE), **Auth**: Emergent Google OAuth

## Implemented Features

### Independent Annual Pricing Structure (Mar 18, 2026) - COMPLETED
- [x] Standalone pricing with validity dates (valid_from / valid_to)
- [x] Package name, duration, per-currency pricing (INR/USD/AED/EUR/GBP)
- [x] Included programs table: name, duration, unit, source tier, discount %
- [x] Calculate Pricing pulls from monthly program rates + applies discounts
- [x] Overall discount %, Notes field
- [x] "Apply to Package Price" auto-fills from calculation
- [x] Validity badge displayed in pricing section
- [x] All 16/16 backend + 100% frontend tests (iteration_79)

### Annual Subscriber CRUD & Management (Mar 18, 2026) - COMPLETED
- [x] Create/Edit/Delete, Quick actions, Excel upload/download
- [x] Auto-fill from config (dates, fee, programs, sessions)
- [x] EMI tracking (up to 12), Session tracking, Student Financials page

### Student Dashboard (Mar 18, 2026) - COMPLETED
- [x] Iris flower layout, glassmorphism, Soul Compass, video upload

### Google OAuth + Previous Features - COMPLETED

## Key API Endpoints
- `GET/PUT /api/admin/subscribers/pricing-config` - Independent annual pricing
- `GET /api/admin/subscribers/calculate-pricing` - Derive from program monthly rates
- `POST /api/admin/subscribers/create` | `PUT update/{id}` | `DELETE delete/{id}`
- `POST /api/admin/subscribers/emi-payment` | `session-update`
- `POST upload` | `GET download-template` | `GET export` | `GET list`
- `GET /api/student/home` - Student dashboard data

## Upcoming Tasks
- **P0:** Dashboard sub-pages (Growth Roadmap, Mini Diary, Monthly Reports)
- **P1:** RBAC Middleware

## Admin: /admin (admin / divineadmin2024) | Student: /login → /dashboard

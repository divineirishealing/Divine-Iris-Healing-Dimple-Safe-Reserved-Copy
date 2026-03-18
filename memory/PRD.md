# Divine Iris Healing - Product Requirements Document

## Original Problem Statement
Build a pixel-perfect clone of https://divineirishealing.com/ with comprehensive admin panel, evolving into a Multi-Tiered Student Growth Platform.

## Architecture
- **Frontend**: React + TailwindCSS + shadcn/ui
- **Backend**: FastAPI + Pydantic + Motor (async MongoDB)
- **Database**: MongoDB | **Payments**: Stripe | **Auth**: Emergent Google OAuth

## Implemented Features

### Annual Pricing Structure - Per-Program Pricing (Mar 18, 2026) - COMPLETED
- [x] Per-program: Price Per Unit → Total (auto: unit × duration) → Offer Price → Discount % (auto)
- [x] Currency switcher (INR/USD/AED/EUR/GBP) for viewing pricing per currency
- [x] Package Total row sums all programs with overall discount %
- [x] Source tier removed; pricing is now fully independent
- [x] Validity dates (valid_from / valid_to) with badge
- [x] All 20/20 backend + 100% frontend tests (iteration_80)

### Annual Subscriber CRUD (Mar 18, 2026) - COMPLETED
### Student Dashboard (Mar 18, 2026) - COMPLETED
### Google OAuth + Previous Features - COMPLETED

## Upcoming Tasks
- **P0:** Dashboard sub-pages (Growth Roadmap, Mini Diary, Monthly Reports)
- **P1:** RBAC Middleware

## Admin: /admin (admin / divineadmin2024) | Student: /login → /dashboard

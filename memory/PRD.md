# Divine Iris Healing - PRD

## Architecture
React + TailwindCSS + shadcn/ui | FastAPI + Motor MongoDB | Stripe | Emergent Google OAuth

## Implemented Features

### Multi-Package Pricing System (Mar 18, 2026) - COMPLETED
- [x] Multiple package variants (PKG-STANDARD, PKG-VIP, etc.) with unique IDs
- [x] Per-program: /Unit, Offer/Unit (NEW), Total (auto), Offer Total (auto), Disc % (auto)
- [x] Additional package-level discount %
- [x] Taxes: GST 18% (INR), VAT 5% (AED)
- [x] Subscriber form: Package selector dropdown to tag subscribers to packages
- [x] Auto-fill from selected package (pricing, programs, sessions)
- [x] Create/Delete packages from admin UI

### Previous: Subscriber CRUD, Student Dashboard, Google OAuth — COMPLETED

## Admin: /admin (admin / divineadmin2024) | Student: /login → /dashboard

# Divine Iris Healing - Product Requirements Document

## Architecture
React + TailwindCSS + shadcn/ui | FastAPI + Motor MongoDB | Stripe | Emergent Google OAuth

## Implemented Features

### Annual Pricing - Inline 3-Currency Table with Taxes (Mar 18, 2026) - COMPLETED
- [x] All 3 currencies (INR, USD, AED) shown inline — no currency switcher
- [x] Per program: Per Unit → Total (auto) → Offer → Discount % (auto) per currency
- [x] Tax row: GST 18% (India/INR), VAT 5% (Dubai/AED), none for USD
- [x] Annual Package Price = Offer + Tax per currency
- [x] No number spinners (text inputs with inputMode=decimal)
- [x] Compact config: Package Name, Duration, Valid From/To, Sessions, Notes — one row
- [x] Validity badge, Save button
- [x] 100% frontend tests passed (iteration_81)

### Annual Subscriber CRUD, Student Dashboard, Google OAuth — COMPLETED

## Admin: /admin (admin / divineadmin2024) | Student: /login → /dashboard

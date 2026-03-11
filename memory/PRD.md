# Divine Iris Healing - Product Requirements Document

## Original Problem Statement
Build a pixel-perfect clone of https://divineirishealing.com/ with comprehensive admin panel, robust enrollment system with anti-fraud India-gating, custom duration tiers, promotions/coupon system, geo-currency detection, and multi-program cart system.

## Architecture
- **Frontend**: React + TailwindCSS + shadcn/ui
- **Backend**: FastAPI + Pydantic + Motor (async MongoDB)
- **Database**: MongoDB
- **Payments**: Stripe (test mode) via emergentintegrations
- **Email**: Resend (configured, pending domain verification)

## What's Been Implemented

### Multi-Program Cart System (COMPLETED - Mar 11, 2026)
- [x] **"Add to Cart" button** on all homepage cards (Flagship + Upcoming sections)
- [x] **Cart icon with badge** in header showing item count
- [x] **Cart Page** (/cart) with multi-program, multi-participant management
- [x] **Per-program participant forms** — expand/collapse, add/remove participants
- [x] **Same participant in multiple programs** — fully supported
- [x] **Cart persistence** in localStorage (survives refresh, clears on payment)
- [x] **Cart Checkout** (/cart/checkout) — split layout: left=Order Summary, right=3-step checkout
- [x] **Promo code at checkout** with real-time validation

### Split-Screen Enrollment (COMPLETED - Mar 11, 2026)
- [x] **Left panel (fixed)**: Program image, title, tier badge, description, date, price breakdown
- [x] **Right panel (scrollable)**: 4-step form (Participants → Review+Promo → Billing+OTP → Pay)
- [x] **Mobile responsive**: Stacks vertically on small screens

### Geo-Currency Auto-Detection (COMPLETED - Mar 11, 2026)
- [x] **IP-based detection** via ip-api.com — UAE→AED, India→INR, US→USD
- [x] **Single currency display** — no more 3-currency pricing
- [x] **Non-primary currencies** converted from AED via admin-managed fixed exchange rates
- [x] **Exchange Rates admin tab** with 38+ currencies

### Previous Features (All COMPLETED)
- Duration tier selectors (1 Month/3 Months/Annual) on all program cards
- "Contact for Pricing" for Annual tier → Request Quote form
- Excel-like pricing table in admin panel
- Multi-Person Enrollment with anti-fraud India-gating
- Promotions & Coupons (percentage/fixed, multi-currency)
- 13-tab Admin Panel
- Stripe payment integration
- Resend email integration

## Key Pages
- `/` — Homepage (Hero, About, Upcoming, Flagship, Stats, Testimonials)
- `/program/:id` — Program detail with duration tier cards
- `/enroll/program/:id?tier=X` — Split-screen single-program enrollment
- `/cart` — Multi-program cart with participant management
- `/cart/checkout` — Cart checkout (Promo → Billing+OTP → Pay)
- `/contact?program=X&title=Y&tier=Z` — Request Quote / Contact
- `/admin` — 13-tab admin panel

## Key API Endpoints
- `GET /api/currency/detect` — IP-based currency detection
- `GET/PUT /api/currency/exchange-rates` — Admin exchange rates
- `GET/POST/PUT/DELETE /api/programs` — Programs CRUD
- `GET/POST/PUT/DELETE /api/promotions` — Promotions CRUD
- `POST /api/promotions/validate` — Validate coupon code
- `POST /api/enrollment/start` — Create enrollment
- `POST /api/enrollment/{id}/send-otp` — Send OTP
- `POST /api/enrollment/{id}/verify-otp` — Verify OTP
- `POST /api/enrollment/{id}/checkout` — Stripe checkout
- `POST /api/enrollment/quote-request` — Save quote request

## Prioritized Backlog

### P0 - High Priority
- [ ] User login/registration system
- [ ] Annual Subscriber dashboard (programs, sessions, payments, progress)
- [ ] Annual Subscriber special discount tier

### P1 - Medium Priority
- [ ] Verify Resend domain for live email
- [ ] Replace mock phone OTP with real provider (Twilio/Firebase)
- [ ] Mobile responsiveness audit
- [ ] PPP enforcement: Block INR if billing country ≠ India + VPN

### P2 - Low Priority
- [ ] SEO meta tags
- [ ] Admin analytics dashboard
- [ ] Bulk export enrollments (CSV)
- [ ] Quote request management in admin panel

## Admin Credentials
- URL: /admin | Username: admin | Password: divineadmin2024

## Test Data
- 6 programs: All flagship with 3 tiers (1 Month/3 Months/Annual)
- Annual tier: price=0 → triggers "Contact for Pricing"
- Promo codes: EARLY50 (fixed), NY2026 (15% off)
- Phone OTP: MOCKED (test code displayed on screen)

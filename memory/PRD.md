# Divine Iris Healing - Product Requirements Document

## Original Problem Statement
Build a pixel-perfect clone of https://divineirishealing.com/ with a comprehensive admin panel, robust enrollment system with anti-fraud India-gating, custom duration tiers, and a promotions/coupon system.

## Architecture
- **Frontend**: React + TailwindCSS + shadcn/ui
- **Backend**: FastAPI + Pydantic + Motor (async MongoDB)
- **Database**: MongoDB
- **Payments**: Stripe (test mode) via emergentintegrations
- **Email**: Resend (configured, pending domain verification)

## What's Been Implemented

### Programs Enhancement (COMPLETED - Mar 2026)
- [x] **Session Mode**: Each program has Online (Zoom) / Remote Healing / Both
- [x] **Start & End Dates**: Displayed on program detail and upcoming sections
- [x] **Flagship Programs**: Toggle to enable custom duration tiers
- [x] **Custom Duration Tiers**: Admin defines any number of tiers (label, duration value/unit, per-tier pricing in AED/INR/USD)
- [x] **Duration Tier Cards**: Program detail page shows tier cards with Select buttons
- [x] **Upcoming Programs**: Shows session mode badges, dates, available durations

### Promotions & Coupons System (COMPLETED - Mar 2026)
- [x] **3 Promo Types**: Coupon Code, Early Bird, Limited Time Offer
- [x] **2 Discount Types**: Percentage (%) or Fixed Amount
- [x] **Multi-Currency Fixed Discounts**: AED (base), INR, USD
- [x] **Applicability**: All programs or specific programs (checkboxes)
- [x] **Usage Limits**: Max uses, used count tracking
- [x] **Date Control**: Start date, expiry date
- [x] **Validation API**: POST /api/promotions/validate - checks code, expiry, usage, program applicability
- [x] **Admin CRUD**: Full create/edit/delete in Promotions tab

### Comprehensive Admin Panel (12 Tabs)
1. Hero Banner — Video, title/subtitle styling, live preview
2. About — Logo, photo, bio, name, title, button
3. Programs — CRUD, session mode, dates, flagship toggle, duration tiers, pricing
4. Sessions — CRUD, visibility, reorder, pricing
5. Testimonials — CRUD, graphic/video types
6. Stats — Full CRUD
7. Newsletter — Heading, description, button, footer text
8. Header & Footer — Social links, contact info, copyright
9. Enrollments — View all enrollments + payments
10. Promotions — Create/edit/delete coupons, early bird, limited time offers
11. Subscribers — Email list
12. Global Styles — Fonts, colors, sizes, per-section overrides

### Multi-Person Enrollment v2
- [x] 3-step flow: Participants → Verify → Pay
- [x] Per-participant: country, attendance mode, notification toggle
- [x] Anti-fraud India-gating (VPN, IP, phone, BIN checks)

### Email Notifications (Resend)
- [x] Booker confirmation + participant notifications
- [x] Pending: Domain verification for custom sender

## Key API Endpoints
- `GET/POST/PUT/DELETE /api/promotions` — Promotions CRUD
- `POST /api/promotions/validate` — Validate coupon code
- `GET /api/promotions/active` — Active promotions (with program filter)
- `GET/PUT /api/settings` — All site settings
- `GET/POST/PUT/DELETE /api/programs` — Programs with duration_tiers, session_mode, is_flagship
- `POST /api/enrollment/start` — Multi-person enrollment
- `POST /api/enrollment/{id}/checkout` — Stripe checkout

## Prioritized Backlog

### P0 - High Priority (Phase 2)
- [ ] User login/registration system
- [ ] Annual Subscriber dashboard (enrolled programs, upcoming sessions, availed vs remaining, payment history, next due, reminders, progress tracking)
- [ ] Annual Subscriber special discount tier
- [ ] Apply coupon codes in enrollment checkout flow

### P1 - Medium Priority
- [ ] Verify Resend domain for live email
- [ ] Replace mock phone OTP with real provider
- [ ] Mobile responsiveness audit

### P2 - Low Priority
- [ ] SEO meta tags
- [ ] Admin analytics dashboard
- [ ] Bulk export enrollments (CSV)

## Admin Credentials
- URL: /admin | Username: admin | Password: divineadmin2024

## Test Data
- AWRP (Program 1): Flagship, 3 tiers (1mo/3mo/1yr), session_mode: both
- NY2026: 15% coupon, all programs, 100 uses
- EARLY50: Fixed AED 50/INR 1000/USD 15, early bird

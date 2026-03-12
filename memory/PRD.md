# Divine Iris Healing - Product Requirements Document

## Original Problem Statement
Build a pixel-perfect clone of https://divineirishealing.com/ with comprehensive admin panel, robust enrollment system with anti-fraud India-gating, custom duration tiers, promotions/coupon system, geo-currency detection, and multi-program cart system.

## Architecture
- **Frontend**: React + TailwindCSS + shadcn/ui
- **Backend**: FastAPI + Pydantic + Motor (async MongoDB)
- **Database**: MongoDB
- **Payments**: Stripe (TEST MODE) via emergentintegrations
- **Email**: Resend (configured, pending domain verification)

## What's Been Implemented

### Dynamic Program Detail Page + Admin Content Sections (COMPLETED - Mar 12, 2026)
- [x] **Content Sections model** — Each program can have multiple content sections with title, subtitle, body, image, enable/disable toggle, and order
- [x] **Font styling per section** — Title, subtitle, and body each support font color, size, bold, italic, font family via admin
- [x] **ProgramDetailPage redesign** — Dynamically renders enabled content sections with alternating backgrounds; falls back to description if no sections configured
- [x] **Admin Content Section Editor** — In Programs tab, edit program form now includes "Page Content Sections" with add/reorder/remove/toggle/font-styling controls

### Footer & Navigation Updates (COMPLETED - Mar 12, 2026)
- [x] **Gold icons** for email (Mail) and phone (Phone) in footer contact section
- [x] **Program links** in footer correctly navigate to `/program/:id` pages
- [x] **Terms & Conditions** link → `/terms` page
- [x] **Privacy Policy** link → `/privacy` page
- [x] **10 social media platforms** with admin toggle on/off: Facebook, Instagram, YouTube, LinkedIn, Spotify, Pinterest, TikTok, Twitter/X, Apple Music, SoundCloud

### Admin Panel Enhancements (COMPLETED - Mar 12, 2026)
- [x] **Header & Footer tab** split into 4 sub-tabs: Social Media, Footer Content, Terms & Privacy, Sender Emails
- [x] **Terms & Conditions editor** — Textarea in admin, content displays on /terms page
- [x] **Privacy Policy editor** — Textarea in admin, content displays on /privacy page
- [x] **Sender Email Configuration** — Add/remove sender emails per purpose (receipts, subscriptions, etc.)
- [x] **Stats font styling** — Icon field (FontAwesome), value style, label style with color/size/bold/italic/font controls

### Per-Program Mode Toggles (COMPLETED - Mar 12, 2026)
- [x] 3 mode toggles per program: Online, Offline, In Person
- [x] Admin Panel: 3 styled checkboxes with descriptions
- [x] Homepage/Enrollment/Cart: Only enabled modes appear

### Discounts & Loyalty System (COMPLETED - Mar 12, 2026)
- [x] Group, Combo, and Loyalty discounts with admin toggles
- [x] Dynamic recalculation in cart

### UID System (COMPLETED - Mar 12, 2026)
- [x] Auto-generated participant UIDs on payment confirmation

### Multi-Program Cart System (COMPLETED - Mar 11, 2026)
- [x] Add to Cart, Cart Page, Cart Checkout with multi-program/multi-participant support

### Previous Features (All COMPLETED)
- Geo-Currency Auto-Detection
- Exchange Rates admin tab
- Duration tier selectors
- Multi-Person Enrollment with anti-fraud India-gating
- Promotions & Coupons system
- 14-tab Admin Panel
- Stripe payment integration (TEST MODE)
- Resend email integration
- Post-payment links (WhatsApp, Zoom, Custom)
- First-time attendee tracking
- Referral source tracking

## Key Pages
- `/` — Homepage
- `/program/:id` — Dynamic program detail (content sections)
- `/enroll/program/:id?tier=X` — Split-screen enrollment
- `/cart` — Multi-program cart
- `/cart/checkout` — Cart checkout
- `/contact?program=X&title=Y&tier=Z` — Request Quote
- `/terms` — Terms & Conditions
- `/privacy` — Privacy Policy
- `/admin` — Admin panel

## Prioritized Backlog

### P0 - High Priority
- [ ] Testimonials System (text-based, program-specific, searchable, merge into Transformations)
- [ ] Global Site Search (keyword search across all content)
- [ ] User login/registration system
- [ ] Annual Subscriber dashboard

### P1 - Medium Priority
- [ ] Verify Resend domain for live email
- [ ] Replace mock phone OTP with real provider
- [ ] Mobile responsiveness audit
- [ ] PPP enforcement (billing country + VPN + phone cross-check)

### P2 - Low Priority
- [ ] SEO meta tags
- [ ] Admin analytics dashboard
- [ ] Bulk export enrollments (CSV)
- [ ] Quote request management in admin
- [ ] WhatsApp Business API integration

## Admin Credentials
- URL: /admin | Username: admin | Password: divineadmin2024

## Test Data
- 6 programs: All flagship with 3 tiers (1 Month/3 Months/Annual)
- Annual tier: price=0 → "Contact for Pricing"
- Promo codes: EARLY50 (fixed), NY2026 (15% off)
- Phone OTP: MOCKED
- Stripe: TEST MODE

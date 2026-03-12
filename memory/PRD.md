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

### Stripe Payment Fix (COMPLETED - Mar 11, 2026)
- [x] **"Invalid price" bug fixed** — checkout now passes tier_index + client_currency to server-side pricing
- [x] **Duration tier pricing** flows correctly through enrollment → OTP → Stripe checkout
- [x] **Multi-currency support** — Stripe receives correct amount in detected currency (USD/AED/INR)

### Discounts & Loyalty System (COMPLETED - Mar 12, 2026)
- [x] **Admin "Discounts & Loyalty" tab** — Clean UI with 4 toggle-based sections + active preview
- [x] **Referral Program toggle** — Show/hide "Referred by" field during enrollment globally for all flagship programs
- [x] **Group Discount** — Auto-discount based on participant count (configurable rules, e.g., 3+ → 10% off)
- [x] **Combo Discount** — Auto-discount when 2+ programs in cart (configurable % and min programs)
- [x] **Loyalty Program** — Auto-discount for returning clients with existing UID (configurable %)
- [x] **Backend API** — GET /api/discounts/settings, POST /api/discounts/calculate, GET /api/discounts/check-loyalty/{email}
- [x] **Conditional referral** — Enrollment and Cart pages conditionally show referral section based on admin toggle

### UID System, Referral, Cart Discount Fix, 32 Countries (COMPLETED - Mar 12, 2026)
- [x] **UID System** — Auto-generated `DIH-{PROGRAM}-{INITIALS}-{SEQ}` format (e.g., DIH-AWRP-JD-0001) using MongoDB counter. Generated on payment confirmation, shown on success page and email
- [x] **Cart Discount Bug Fixed** — CartContext now stores offer prices; CartPage/CartCheckoutPage show strikethrough for discounted items
- [x] **32 Country Codes** — Added 15 more countries (Nepal, Kuwait, Oman, Bahrain, Philippines, Indonesia, Thailand, Kenya, Nigeria, Egypt, Turkey, Italy, Spain, Netherlands, New Zealand)
- [x] **Referral Toggle** — "Referred by a Divine Iris member" checkbox + referrer name field on enrollment and cart pages
- [x] **Backend Offer Price Fix** — Stripe checkout now uses offer_price_{currency} when > 0 for all currencies including AED

### Bug Fixes — Mar 12, 2026
- [x] **Image Upload Fixed** — Rewrote ImageUploader with proper drag-and-drop support (onDrop, onDragOver handlers) and click-to-upload via hidden file input ref
- [x] **Phone/WhatsApp Country Codes** — Added mandatory country code dropdown (+91, +971, +1, etc.) before phone and WhatsApp fields in both Enrollment and Cart pages, with 10-digit limit
- [x] **Strike-off Prices Fixed** — Added `offer_price_aed` to backend model, fixed admin "Offer AED" column (was saving to wrong field), fixed CurrencyContext to return AED offers for non-flagship programs

### Post-Payment Links & Participant Insights (COMPLETED - Mar 11, 2026)
- [x] **Program Links in Admin Panel** — WhatsApp Group, Zoom Meeting, Custom Link fields with toggle switches in program form
- [x] **Links on Payment Success Page** — Beautiful card-based link buttons (WhatsApp green, Zoom blue, custom gold) shown after payment
- [x] **Links in Confirmation Email** — Same links rendered as styled buttons in the enrollment receipt email
- [x] **"First time joining Divine Iris Healing" checkbox** — Per-participant, in both Enrollment and Cart pages
- [x] **"How did you hear about us?" dropdown** — 8 referral sources (Instagram, Facebook, YouTube, Google Search, Friend/Family, WhatsApp, Returning Client, Other)
- [x] **Enhanced Payment Success Page** — Full receipt with participants list, amounts, booker info, and program links
- [x] **Enhanced Confirmation Email** — Includes participant table with first-time status, program links as CTA buttons
- [x] **Backend support** — ParticipantData model includes is_first_time & referral_source; payment status returns program_links

### WhatsApp Number Collection (COMPLETED - Mar 11, 2026)
- [x] **WhatsApp field** in participant notification section (both Enrollment + Cart pages)
- [x] **Green WhatsApp icon** with "WhatsApp No." placeholder
- [x] **Stored in DB** alongside email and phone for manual group adding

### Multi-Program Cart System (COMPLETED - Mar 11, 2026)
- [x] "Add to Cart" button on all homepage cards
- [x] Cart icon with badge in header
- [x] Cart Page (/cart) with multi-program, multi-participant management
- [x] Cart Checkout (/cart/checkout) with split layout
- [x] Promo code at checkout
- [x] Cart persistence in localStorage

### Split-Screen Enrollment (COMPLETED - Mar 11, 2026)
- [x] Left panel (fixed): Program image, title, tier, price breakdown
- [x] Right panel (scrollable): 4-step form
- [x] Mobile: Stacks vertically

### Previous Features (All COMPLETED)
- Geo-Currency Auto-Detection (IP → single currency)
- Exchange Rates admin tab (38+ currencies)
- Duration tier selectors on all program cards
- "Contact for Pricing" → Request Quote form
- Excel-like pricing table in admin
- Multi-Person Enrollment with anti-fraud India-gating
- Promotions & Coupons system
- 13-tab Admin Panel
- Stripe payment integration (TEST MODE)
- Resend email integration

## Key Pages
- `/` — Homepage
- `/program/:id` — Program detail
- `/enroll/program/:id?tier=X` — Split-screen enrollment
- `/cart` — Multi-program cart
- `/cart/checkout` — Cart checkout
- `/contact?program=X&title=Y&tier=Z` — Request Quote
- `/admin` — Admin panel

## Prioritized Backlog

### P0 - High Priority
- [ ] User login/registration system
- [ ] Annual Subscriber dashboard
- [ ] Annual Subscriber special discount tier

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
- [ ] WhatsApp Business API integration for automated group invites

## Admin Credentials
- URL: /admin | Username: admin | Password: divineadmin2024

## Test Data
- 6 programs: All flagship with 3 tiers (1 Month/3 Months/Annual)
- Annual tier: price=0 → "Contact for Pricing"
- Promo codes: EARLY50 (fixed), NY2026 (15% off)
- Phone OTP: MOCKED
- Stripe: TEST MODE

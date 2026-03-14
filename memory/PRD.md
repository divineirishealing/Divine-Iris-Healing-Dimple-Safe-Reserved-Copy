# Divine Iris Healing - Product Requirements Document

## Original Problem Statement
Build a pixel-perfect clone of https://divineirishealing.com/ with comprehensive admin panel.

## Architecture
- **Frontend**: React + TailwindCSS + shadcn/ui
- **Backend**: FastAPI + Pydantic + Motor (async MongoDB)
- **Database**: MongoDB
- **Payments**: Stripe (TEST MODE)
- **Email**: Google Workspace SMTP (noreply@divineirishealing.com)

## Design System (designTokens.js)
| Token | Font | Weight | Purpose |
|-------|------|--------|---------|
| HEADING | Cinzel | 700 (Bold) | All section headings (h1-h6) |
| SUBTITLE | Lato | 300 (Light) | Subtitles, secondary text |
| BODY | Lato | 400 (Regular) | All body text, programs, sessions |
| LABEL | Lato | 600 (SemiBold) | Uppercase tracking labels |
| CONTAINER | — | — | `container mx-auto px-6 md:px-8 lg:px-12` |
| GOLD | #D4AF37 | — | Accent color |

## Implemented Features

### Admin Efficiency: Pricing Hub & Upcoming Hub (Mar 14, 2026) - COMPLETED
- [x] Pricing Hub: Excel-style grid for ALL programs + sessions with AED/INR/USD base & offer prices
- [x] Duration tier sub-rows (1 Month, 3 Month, Annual) with editable tier pricing
- [x] Upcoming Hub: Excel-style grid for all card settings (Upcoming/Flagship/Enrollment toggles, closure text, dates, timing, timezone, exclusive offer, mode badges)
- [x] Closure text dropdown (Registration Closed, Seats Full, Enrollment Closed, Sold Out) when enrollment OFF
- [x] Single "Save All" button per tab for batch saves
- [x] Big prominent closure badge + faded/dimmed look on BOTH card types when enrollment is OFF
- [x] All 12/12 backend + 100% frontend tests passing (iteration 47)

### Program Card Closure Logic Redesign (Mar 14, 2026) - COMPLETED
- [x] Flagship cards: NEVER show "Registration Closed" overlay — always clean, full color, no dimming
- [x] Upcoming cards: Closure is now ONLY admin-controlled via `enrollment_open` toggle (no auto-expire)
- [x] Admin dropdown for custom closure text: "Registration Closed", "Seats Full", "Enrollment Closed", "Sold Out"
- [x] Custom closure text shown in overlay badge AND on disabled enroll button
- [x] All 10/10 tests passing (iteration 46)

### Program Card Image Overlay Redesign (Mar 14, 2026) - COMPLETED
- [x] Dates/times moved to TOP-RIGHT of image (stacked: start, end, timing IST, local TZ)
- [x] Gold duration badge (e.g., "21 Days") positioned below dates at top-right
- [x] Mode badges (Online/Offline) remain at top-left
- [x] Countdown timer remains at bottom-left
- [x] NEW: Exclusive Offer badge in RED at bottom-right (pulsing, beside countdown)
- [x] Admin toggle ON/OFF + editable text per program (default: "Limited Time Offer")
- [x] Consistent layout applied to both Upcoming and Flagship program cards
- [x] All 10/10 frontend + backend tests passing (iteration 45)

### Program Card Layout Consistency (Mar 14, 2026) - COMPLETED
- [x] Upcoming Programs: Gold duration badge (e.g., "21 Days") added above dates on image overlay
- [x] Flagship Programs: Full layout replicated from Upcoming — countdown timer, dates, duration, timing + timezone, mode badges, early bird banner, pricing with cart/enroll buttons
- [x] Both card types now share identical visual structure and interaction patterns
- [x] All 13/13 frontend tests passing (iteration 44)

### Program Timing & Local Timezone (Mar 13, 2026) - COMPLETED
- [x] Added `timing` and `time_zone` fields to Program backend model
- [x] Program detail page hero displays duration, start_date, timing, and timezone
- [x] Local timezone conversion shown in blue ("X:XX PM Your Time (TZ)")
- [x] Upcoming Programs cards show timing with localized conversion
- [x] Admin panel supports editing timing and timezone per program
- [x] Gracefully handles programs without timing data
- [x] All tests passing (9/9 backend, 100% frontend - iteration 43)

### Email OTP Verification (Mar 13, 2026) - COMPLETED
- [x] Switched from Resend to Google Workspace SMTP
- [x] Sends OTP from noreply@divineirishealing.com via smtp.gmail.com:587
- [x] 6-digit OTP with 5-minute expiry, max 5 attempts
- [x] Frontend enrollment page fully updated for email OTP flow

### Payment Settings & Anti-Fraud (Mar 13, 2026) - COMPLETED
- [x] Phone cross-validation for Indian pricing (IP + country + phone must all match India)
- [x] Regional currency mapping: UAE/Gulf->AED, US/UK/EU/AU->USD, India->INR
- [x] Auto country code population in enrollment form
- [x] Payment disclaimer text on enrollment pages (configurable from admin)
- [x] India-specific payment options (Exly, GPay, Bank Transfer)
- [x] New "Payments" admin tab and "API Keys" admin tab
- [x] Keys stored in MongoDB, falls back to .env

### Personal Sessions Visual Redesign & Admin Controls
- [x] Purple gradient intensity controls (homepage & detail page)
- [x] Comprehensive visibility/reordering panel
- [x] Extensive style controls: fonts, colors for hero, body, buttons, calendar
- [x] Editable info cards
- [x] Per-session and global special offer system

### Luxury Email Receipt - COMPLETED
- [x] Customizable HTML receipt template
- [x] Admin tab with controls for fonts, colors, content toggles
- [x] Send Preview function

### Other Completed Features
- [x] Multi-Item Cart
- [x] Dynamic Header & Footer Navigation
- [x] Unified Design System with Cinzel/Lato fonts
- [x] Program Detail Page with admin sections
- [x] About Page with admin editors
- [x] Social Media + Legal Pages
- [x] Enrollment flow with geo-pricing (India PPP)
- [x] Stripe payment integration
- [x] Promotions & Discounts system
- [x] Exchange Rates management
- [x] Newsletter & Subscribers
- [x] Testimonials management
- [x] Session calendar, testimonials, questions managers
- [x] Excel upload for sessions
- [x] Image upload system
- [x] Global pricing font control

### Program Card Date/Time on Image + Local Timezone (Mar 14, 2026) - COMPLETED
- [x] Moved dates and timing from card body onto the program card image
- [x] Date/time positioned at bottom-right of image, alongside countdown timer at bottom-left
- [x] Admin sets time in IST; card auto-converts to viewer's local timezone
- [x] Bold, bigger text (11px) with pill backgrounds for high visibility
- [x] Supports all major timezone abbreviations

### India Payment: Exly Gateway + Bank Transfer (Mar 14, 2026) - COMPLETED
- [x] Replaced GPay/UPI with Exly payment gateway
- [x] Added Bank Transfer option with admin-configurable bank details
- [x] Bank Transfer has proof submission form
- [x] Admin "India Proofs" tab for viewing/approving/rejecting bank transfer proofs
- [x] All settings configurable from admin "Payments" tab

### Stripe: Disabled Adaptive Pricing (Mar 14, 2026) - COMPLETED
- [x] Disabled "Choose a currency" popup on Stripe checkout
- [x] Original currency behavior preserved: INR for India, AED for UAE, USD for others

## Pending / Upcoming Tasks

### P1: Global & Testimonial Search
- Global site search functionality
- Keyword-based testimonial search

### P2: Video Testimonials
- Support for embedding/managing video testimonials

### P3: Reply to Questions (Admin UI)
- UI in admin panel to reply to submitted questions
- Backend APIs already in place

### P4: User Login & Subscriber Dashboard
- User authentication system
- Dedicated subscriber dashboard

### P5: Advanced Anti-Fraud for Geo-Pricing
- Stricter validation for PPP pricing
- External service integration

## 3rd Party Integrations
| Service | Purpose | Status |
|---------|---------|--------|
| Stripe | Payments | Active (test mode) |
| Google Workspace SMTP | Email (OTP, receipts, notifications) | Active |
| Resend | Email (backup) | Configured but domain not verified |
| ipinfo.io / ip-api.com | Geolocation | Active (free tier) |
| forex-python | Currency conversion | Available |

## Key Credentials
- Admin: `/admin` — username: `admin`, password: `divineadmin2024`
- SMTP: `noreply@divineirishealing.com` via Google Workspace
- Receipt sender: `receipt@divineirishealing.com`

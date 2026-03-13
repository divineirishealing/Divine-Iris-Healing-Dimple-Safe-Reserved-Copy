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

### Email OTP Verification (Mar 13, 2026) - COMPLETED
- [x] Switched from Resend to Google Workspace SMTP
- [x] Sends OTP from noreply@divineirishealing.com via smtp.gmail.com:587
- [x] 6-digit OTP with 5-minute expiry, max 5 attempts
- [x] Frontend enrollment page fully updated for email OTP flow
- [x] Verified end-to-end: enrollment start → send OTP → receive email → verify OTP
- [x] All backend and frontend tests passing (14/14 backend, 100% frontend)

### API Keys Admin Tab (Mar 13, 2026) - COMPLETED
- [x] New "API Keys" tab in admin panel sidebar
- [x] Shows all configured keys: Stripe, Resend, Google Workspace SMTP, Sender Email, Receipt Email
- [x] Masked values by default, eye toggle to reveal, copy-to-clipboard button
- [x] Security note banner
- [x] Backend endpoint: GET /api/admin/api-keys

### Personal Sessions Visual Redesign & Admin Controls
- [x] Purple gradient intensity controls (homepage & detail page)
- [x] White background for content area
- [x] Star field prominence in hero section
- [x] Comprehensive visibility/reordering panel for homepage & detail page elements
- [x] Extensive style controls: fonts, colors for hero, body, buttons, calendar
- [x] Editable info cards ("What to Expect", "Who Is This For")
- [x] Editable text fields for various UI elements
- [x] Per-session and global special offer system

### Multi-Item Cart
- [x] Add sessions with date/time to cart
- [x] CartContext updated for session items
- [x] CartPage handles session item display and pricing

### Dynamic Header & Footer Navigation
- [x] Admin-configurable navigation items
- [x] Sorted by length, capitalized labels
- [x] Special link handling (Services → Personal Sessions, Media → media page)

### Other Completed Features
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

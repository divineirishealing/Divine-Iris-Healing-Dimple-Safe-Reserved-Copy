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

## Standardized Hero Section Style (Quad Layer Reference)
All pages with dark hero sections use:
- **Title**: HEADING token, gold (#D4AF37), small-caps, letterSpacing: 0.05em, fontSize: clamp(1.8rem, 4vw, 3rem), lineHeight: 1.3
- **Subtitle**: LABEL token, white (#fff), letterSpacing: 0.3em, uppercase
- **Divider**: Gold line (w-14, h-0.5) below subtitle
- **Background**: linear-gradient(180deg, #1a1a1a 0%, #1a1a1add 50%, #1a1a1a 100%)

## Implemented Features

### Hero & Footer Consistency Update (Mar 14, 2026) - COMPLETED
- [x] Standardized hero sections across About, Sponsor, Transformations, Media, Contact pages to match Quad Layer (Program) style
- [x] All heroes: gold title (small-caps, 0.05em letter-spacing), white subtitle (LABEL style, 0.3em tracking), gold divider line
- [x] Footer: Thin golden divider line between phone number and Terms & Conditions
- [x] Footer: "Contact" moved to bottom of MENU column, opens dialog form (not navigation)
- [x] Footer: Contact dialog with inquiry type dropdown (Program / Personal Session / Other)
- [x] Footer: Selecting Program or Session shows second dropdown populated from database
- [x] Footer: All text uses Lato font
- [x] Contact page: Also updated with inquiry type dropdown and consistent hero
- [x] About page: "Meet the Healer" mid-section preserved as-is (gold label, black name, gold subtitle)
- [x] All 15/15 frontend tests passing (iteration 55)

### Hub Sync + Replicate + Express Your Interest (Mar 14, 2026) - COMPLETED
- [x] Programs Hub: Controls scheduling, enrollment, visibility only
- [x] Programs Hub: "Replicate to Flagship" toggle
- [x] Pricing Hub: "Pricing" and "Tiers" toggle columns
- [x] "Notify Me" renamed to "Express Your Interest" everywhere
- [x] Express Your Interest: Collects email via /api/notify-me
- [x] Program detail page: "Express Your Interest" button when pricing/enrollment off
- [x] Coming Soon cards show badge + Express Your Interest email form

### Programs Hub v3 + Detail Page Pricing Control + Sponsor Link (Mar 14, 2026) - COMPLETED
- [x] Programs Hub: Single merged table, non-tiered programs first, tiered below
- [x] Programs Hub: Group toggle removed; Pricing & Tiers toggle columns added
- [x] Homepage: Flagship + upcoming programs render full UpcomingCard
- [x] Program detail page: Respects show_pricing_on_card and show_tiers_on_card toggles
- [x] Pricing Hub: Number spinners removed, labels updated
- [x] Sponsor A Life nav link fixed

### 3-State Enrollment System (Mar 14, 2026) - COMPLETED
- [x] Open / Closed / Coming Soon enrollment status
- [x] "Coming Soon" state shows badge + "Express Your Interest" form
- [x] Flagship cards with tier selectors and pricing

### Other Completed Features
- [x] Multi-Item Cart
- [x] Dynamic Header & Footer Navigation
- [x] Unified Design System with Cinzel/Lato fonts
- [x] Program Detail Page with admin sections
- [x] About Page with admin editors
- [x] Social Media + Legal Pages
- [x] Enrollment flow with geo-pricing (India PPP)
- [x] Stripe payment integration
- [x] Email OTP Verification (Google Workspace SMTP)
- [x] Luxury Email Receipt
- [x] Payment Settings & Anti-Fraud
- [x] India Payment: Exly Gateway + Bank Transfer
- [x] Stripe: Disabled Adaptive Pricing
- [x] Personal Sessions Visual Redesign & Admin Controls
- [x] Promotions & Discounts system
- [x] Exchange Rates management
- [x] Newsletter & Subscribers
- [x] Testimonials management
- [x] Session calendar, testimonials, questions managers
- [x] Excel upload for sessions
- [x] Image upload system
- [x] Global pricing font control

## Pending / Upcoming Tasks

### P1: Admin View/Reply to Questions
- UI in admin panel to reply to submitted questions from Personal Sessions
- Backend APIs already in place

### P2: Global & Testimonial Search
- Global site search functionality
- Keyword-based testimonial search

### P3: Video Testimonials
- Support for embedding/managing video testimonials

### P4: User Login & Subscriber Dashboard
- User authentication system
- Dedicated subscriber dashboard

### P5: Advanced Anti-Fraud for Geo-Pricing
- Stricter validation for PPP pricing

## 3rd Party Integrations
| Service | Purpose | Status |
|---------|---------|--------|
| Stripe | Payments | Active (test mode) |
| Google Workspace SMTP | Email (OTP, receipts, notifications) | Active |
| ipinfo.io / ip-api.com | Geolocation | Active (free tier) |
| Framer Motion | UI animations | Active |

## Key Credentials
- Admin: `/admin` — username: `admin`, password: `divineadmin2024`
- SMTP: `noreply@divineirishealing.com` via Google Workspace

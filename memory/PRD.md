# Divine Iris Healing - Product Requirements Document

## Original Problem Statement
Build a pixel-perfect clone of https://divineirishealing.com/ with comprehensive admin panel, robust enrollment system with anti-fraud India-gating, custom duration tiers, promotions/coupon system, geo-currency detection, and multi-program cart system.

## Architecture
- **Frontend**: React + TailwindCSS + shadcn/ui
- **Backend**: FastAPI + Pydantic + Motor (async MongoDB)
- **Database**: MongoDB
- **Payments**: Stripe (TEST MODE) via emergentintegrations
- **Email**: Resend (configured, pending domain verification)
- **Fonts**: Cinzel (headings), Cormorant Garamond (body/sections), Lato (labels), via Google Fonts

## What's Been Implemented

### About Page + Navigation Fix (COMPLETED - Mar 12, 2026)
- [x] `/about` page with hero, logo, Meet the Healer bio, Philosophy, Impact, Mission & Vision sections
- [x] "Read Full Bio" button on homepage links to `/about`
- [x] ABOUT link in header/footer menu navigates to `/about`

### Program Detail Page Redesign (COMPLETED - Mar 12, 2026)
- [x] Hero with Cinzel small-caps title and gold category label
- [x] Dynamic content sections: journey, who_for, experience, cta, custom types
- [x] Fallback default sections when no custom sections configured (The Journey, Who it is for, Your Experience)
- [x] CTA section with "When you are seeking" and Enroll Now / Express Interest buttons
- [x] Duration tier cards for flagship programs
- [x] Testimonials carousel
- [x] Admin content section editor with add/reorder/remove/toggle/font-styling

### Font & Style Unification (COMPLETED - Mar 12, 2026)
- [x] Cinzel for all major headings (hero, programs, about)
- [x] Cormorant Garamond for section headings and body text
- [x] Lato for labels (MEET THE HEALER, categories)
- [x] Updated: ProgramsSection, TestimonialsSection, SessionsSection, SponsorSection, NewsletterSection headings

### Social Media + Legal Pages + Email Config (COMPLETED - Mar 12, 2026)
- [x] 10 social media platforms with toggle on/off (Facebook, Instagram, YouTube, LinkedIn, Spotify, Pinterest, TikTok, Twitter/X, Apple Music, SoundCloud)
- [x] Terms & Conditions page `/terms` with admin editor
- [x] Privacy Policy page `/privacy` with admin editor
- [x] Configurable sender emails per purpose
- [x] Gold icons for email and phone in footer
- [x] Footer program links navigate to `/program/:id`

### Stats Font Styling (COMPLETED - Mar 12, 2026)
- [x] Icon field (FontAwesome), value style, label style with color/size/bold/italic/font controls

### Per-Program Mode Toggles (COMPLETED)
### Discounts & Loyalty System (COMPLETED)
### UID System (COMPLETED)
### Multi-Program Cart System (COMPLETED)
### All Previous Features (COMPLETED)

## Key Pages
- `/` — Homepage
- `/about` — About / Bio page
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

### P1 - Medium Priority
- [ ] User login & subscriber dashboard
- [ ] Replace mock phone OTP with real provider
- [ ] Mobile responsiveness audit
- [ ] Verify Resend domain for live email

### P2 - Low Priority
- [ ] Advanced Anti-Fraud for Geo-Pricing
- [ ] SEO meta tags
- [ ] Admin analytics dashboard
- [ ] Bulk export enrollments (CSV)
- [ ] Quote request management in admin

## Admin Credentials
- URL: /admin | Username: admin | Password: divineadmin2024

## Test Data
- 6 programs: All flagship with 3 tiers (1 Month/3 Months/Annual)
- Annual tier: price=0 -> "Contact for Pricing"
- Promo codes: EARLY50 (fixed), NY2026 (15% off)
- Phone OTP: MOCKED
- Stripe: TEST MODE

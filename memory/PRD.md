# Divine Iris Healing - Product Requirements Document

## Original Problem Statement
Build a pixel-perfect clone of https://divineirishealing.com/ with comprehensive admin panel.

## Architecture
- **Frontend**: React + TailwindCSS + shadcn/ui
- **Backend**: FastAPI + Pydantic + Motor (async MongoDB)
- **Database**: MongoDB
- **Payments**: Stripe (TEST MODE)
- **Email**: Resend (pending domain verification)

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

### Unified Design System (Mar 12, 2026)
- [x] All headings: Cinzel Bold across every page
- [x] All subtitles: Lato 300 light
- [x] All body: Lato 400 regular
- [x] Uniform margins via CONTAINER token
- [x] CSS `!important` override fixed in index.css
- [x] designTokens.js shared across all components

### Program Detail Page
- [x] Hero: Cinzel small-caps, gold category label
- [x] 4 default section types: The Journey, Who It Is For?, Your Experience (dark bg), Why You Need This Now?
- [x] Admin section type dropdown with 6 options
- [x] Image upload per section, font styling options (collapsible)
- [x] CTA with duration tier cards + Enroll Now
- [x] Testimonials carousel

### About Page (/about)
- [x] Hero, Logo, Bio, Philosophy, Impact, Mission & Vision
- [x] Admin: photo upload, philosophy/impact/mission/vision editors
- [x] "Read Full Bio" → /about

### Social Media + Legal Pages + Email Config
- [x] 10 platforms with toggle on/off
- [x] /terms and /privacy admin-editable pages
- [x] Sender email config per purpose
- [x] Gold icons for email/phone in footer

### Admin Panel UX Overhaul (Mar 12, 2026)
- [x] Image adjustment controls (object-fit/object-position) in About tab with live preview
- [x] Image adjustment controls in program content section editor with visual preview
- [x] About page image cropping fixed — applies admin settings (objectFit, objectPosition)
- [x] ProgramDetailPage section images apply image_fit/image_position from content sections
- [x] Testimonials lightbox — graphic testimonials zoom on click (image Dialog)
- [x] Video testimonials still open YouTube embed modal

### Centralized Page Headers + New Pages (Mar 12, 2026)
- [x] Page Headers admin tab: edit hero title/subtitle + font styles for ALL pages in rows
- [x] Pages covered: Homepage, About, Transformations, Media, Blog, + all programs
- [x] "Apply Homepage Style to All" button for uniform font styling
- [x] Media page visibility toggle (on/off in admin)
- [x] Blog page created with hero + visibility toggle (off by default)
- [x] "Meet the Healer" label font now editable in admin
- [x] "Read Full Bio" scrolls to bio section on /about
- [x] About page hero: Cinzel name + white Lato subtitle from centralized settings
- [x] All page heroes read from centralized page_heroes settings

### Bug Fixes & Enhancements (Mar 12, 2026)
- [x] About page image constrained to max-height 450px (was too big)
- [x] Full font controls (family, size, color, bold, italic) on About admin tab for: Name, Title, Bio, Philosophy, Impact, Mission, Vision
- [x] Philosophy card icon: replaced dull SVG with lucide Heart icon
- [x] Impact card icon: replaced dull SVG with lucide Sun icon
- [x] Mission & Vision subtitle now editable in admin (about_mission_vision_subtitle field)
- [x] Footer background standardized to #1a1a1a (was Tailwind gray-900 with blue tint)
- [x] Markdown support: **bold** and *italic* in all body text fields (renderMarkdown.js)
- [x] Program page testimonials now clickable with lightbox modal
- [x] Homepage AboutSection also applies objectFit/objectPosition + markdown rendering

### Previous Features (All COMPLETED)
- Per-program mode toggles, Discounts & Loyalty, UID system
- Multi-program cart + checkout, Geo-currency detection
- Duration tiers, Multi-person enrollment, Promotions
- 14-tab admin panel, Stripe, Resend, Post-payment links

## Key Pages
| Page | Route |
|------|-------|
| Homepage | `/` |
| About | `/about` |
| Program Detail | `/program/:id` |
| Enrollment | `/enroll/program/:id?tier=X` |
| Cart | `/cart` |
| Checkout | `/cart/checkout` |
| Contact | `/contact` |
| Terms | `/terms` |
| Privacy | `/privacy` |
| Admin | `/admin` |

## Backlog
### P1
- [ ] Global Site Search
- [ ] Testimonial keyword search
- [ ] Video testimonial support (YouTube embed management)

### P2
- [ ] User login & subscriber dashboard
- [ ] Replace mock phone OTP
- [ ] Mobile responsiveness audit

### P3
- [ ] Anti-fraud geo-pricing, SEO, Admin analytics, Bulk export

## Admin: admin / divineadmin2024
## Test: 6 programs, EARLY50/NY2026 promos, OTP MOCKED, Stripe TEST

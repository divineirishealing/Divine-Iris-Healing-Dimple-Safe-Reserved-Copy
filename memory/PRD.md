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

### Trust Section Final Design (Mar 17, 2026) - COMPLETED
- [x] Fixed duplication bug: TrustSection.jsx hidden (visible=false in DB), TextTestimonialsStrip.jsx is sole renderer
- [x] Restyled to match reference: large 52px circular beige/gold icons, no card borders
- [x] Metric values in gold Cinzel font (5.0, 97%, 100%, 100%, 100%)
- [x] Philosophy titles in Cinzel small-caps, descriptions in italic Cormorant Garamond
- [x] Google icon with white circle + gold stars, other icons in beige gradient circles
- [x] Rotating testimonial with navigation dots
- [x] All 10/10 frontend tests passed (iteration_73)

### Personal Sessions Admin Page Refactor (Mar 17, 2026) - COMPLETED
- [x] Renamed page title to "Personal Sessions"
- [x] Converted session list from flat list to inline accordion
- [x] Simplified edit form
- [x] All 38/38 frontend tests passed (iteration_70)

### Trust Section Full Implementation (Mar 17, 2026) - COMPLETED
- [x] Fixed "Why Us" philosophy cards not loading
- [x] Added Description field + style controls to Metrics Row editor
- [x] Extended TrustSection.jsx to render all 3 rows
- [x] Added 12 new icon components
- [x] Rotating testimonial quote with fade transitions
- [x] All 10/10 frontend tests passed (iteration_72)

### Excel Export Restructure & Admin Guide (Mar 17, 2026) - COMPLETED
### Hero Background Image Upload for All Pages (Mar 17, 2026) - COMPLETED
### Unified Testimonial Displays Across Site (Mar 16, 2026) - COMPLETED

## Upcoming Tasks
- **P0:** Manual Client Management & Excel Upload
- **P1:** Annual Subscriber Dashboard (Planning)

## Future/Backlog Tasks
- WhatsApp Automation (auto-send group invite after payment)
- User Login & Subscriber Dashboard
- SEO implementation

## Technical Debt
- Deduplicate `create_checkout_no_adaptive` function (exists in both payments.py and enrollment.py)
- TrustSection.jsx is hidden but still exists in codebase (can be cleaned up)

## 3rd Party Integrations
- Stripe (Payments)
- Google Workspace (SMTP for emails)
- ipinfo.io (Geolocation)
- openpyxl (Excel export)
- lucide-react (Icons)

## Key DB Schema
- **site_settings collection**: homepage_sections array with trust section (visible=false), text_testimonials_style
- **Trust section data**: trust_cards (metrics), philosophy_cards, quotes, title/subtitle with style objects

## Admin Credentials
- URL: /admin
- Username: admin
- Password: divineadmin2024

# Divine Iris Healing - Product Requirements Document

## Original Problem Statement
Build a pixel-perfect clone of https://divineirishealing.com/ with comprehensive admin panel, evolving into a Multi-Tiered Student Growth Platform with RBAC, advanced analytics, and interactive tools.

## Architecture
- **Frontend**: React + TailwindCSS + shadcn/ui
- **Backend**: FastAPI + Pydantic + Motor (async MongoDB)
- **Database**: MongoDB
- **Payments**: Stripe (TEST MODE)
- **Email**: Google Workspace SMTP (noreply@divineirishealing.com)
- **Auth**: Emergent-managed Google OAuth (student login)

## Design System
| Token | Font | Weight | Purpose |
|-------|------|--------|---------|
| HEADING | Cinzel | 700 | All section headings |
| SUBTITLE | Lato | 300 | Subtitles |
| BODY | Lato | 400 | Body text |
| GOLD | #D4AF37 | — | Accent color |
| Iris Purple | #5D3FD3 | — | Dashboard primary |
| Sage Green | #84A98C | — | Secondary accent |

## Implemented Features

### Annual Subscriber Database Management (Mar 18, 2026) - COMPLETED
- [x] Excel upload for subscriber data (name, program, dates, fees, EMIs, sessions, programs)
- [x] Up to 12 EMI tracking per subscriber (date, amount, remaining, due date, status)
- [x] Session tracking (carry forward, current, availed, yet to avail, due, scheduled dates)
- [x] Bi-Annual Download & Quarterly Releases counters
- [x] Multiple programs per annual package
- [x] Admin "Annual Subscribers" tab with expandable rows showing all details
- [x] Template download & data export as Excel
- [x] EMI payment recording API & session update API
- [x] Student Financials page: top stats, payment progress, EMI schedule, session ring chart, programs list
- [x] Student dashboard Soul Compass auto-reflects subscription data
- [x] All 9/9 backend + 100% frontend tests passed (iteration_75)

### Student Dashboard - "Modern Spiritual" Redesign (Mar 18, 2026) - COMPLETED
- [x] Full-screen immersive purple gradient atmosphere with iris flower layout
- [x] 5 glassmorphism petal cards (Schedule, Profile, Soul Compass, Sacred Exchange, Galaxy of Magic)
- [x] SVG progress ring, tier-based sidebar, dual-theme sidebar
- [x] Video upload option in Sanctuary Settings admin tab
- [x] All 8/8 backend + 100% frontend tests passed (iteration_74)

### Google OAuth Authentication (Mar 18, 2026) - COMPLETED
- [x] Whitelist-only access via Client Garden
- [x] Tier assignment based on client label

### Previous Features (Mar 16-17, 2026) - COMPLETED
- Trust Section, Personal Sessions Admin, Excel Export, Hero Background Upload, Testimonials

## Upcoming Tasks
- **P0:** Build remaining Student Dashboard sub-pages (Growth Roadmap, Mini Diary, Monthly Reports)
- **P1:** RBAC Middleware (backend route protection based on 4 tiers)
- **P2:** Admin command center for managing student tiers & payment statuses inline

## Future/Backlog Tasks
- Razorpay integration for Indian payments
- Advanced progress visualization charts (Past vs Present)
- Interactive tools (Calendar sync, Report submission)
- WhatsApp automation
- SEO implementation

## Technical Debt
- Deduplicate `create_checkout_no_adaptive` function
- TrustSection.jsx cleanup (hidden but exists)

## Key DB Schema
- **clients.subscription**: `{ annual_program, start_date, end_date, total_fee, currency, payment_mode, num_emis, emis[], sessions{}, programs[], bi_annual_download, quarterly_releases }`
- **users**: `{ id, email, name, tier, client_id, profile_approved }`
- **sessions (auth)**: `{ token, user_id, expires_at }`

## Key API Endpoints
- `POST /api/admin/subscribers/upload` - Upload subscriber Excel
- `GET /api/admin/subscribers/download-template` - Download blank template
- `GET /api/admin/subscribers/export` - Export all subscribers
- `GET /api/admin/subscribers/list` - List subscribers
- `POST /api/admin/subscribers/emi-payment` - Record EMI payment
- `POST /api/admin/subscribers/session-update` - Update session count
- `GET /api/student/home` - Student home data (financials, sessions, programs)

## Admin Credentials
- URL: /admin, Username: admin, Password: divineadmin2024

## Student Dashboard Access
- URL: /login → /dashboard
- Auth: Google OAuth (must be in Client Garden)

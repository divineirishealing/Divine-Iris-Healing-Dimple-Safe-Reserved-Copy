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

## Design System (designTokens.js)
| Token | Font | Weight | Purpose |
|-------|------|--------|---------|
| HEADING | Cinzel | 700 (Bold) | All section headings (h1-h6) |
| SUBTITLE | Lato | 300 (Light) | Subtitles, secondary text |
| BODY | Lato | 400 (Regular) | All body text, programs, sessions |
| LABEL | Lato | 600 (SemiBold) | Uppercase tracking labels |
| CONTAINER | — | — | `container mx-auto px-6 md:px-8 lg:px-12` |
| GOLD | #D4AF37 | — | Accent color |

## Student Dashboard Design System
| Token | Value | Purpose |
|-------|-------|---------|
| Iris Purple | #5D3FD3 | Primary dashboard color |
| Deep Purple | #2D1B69 | Dark background gradient start |
| Light Purple | #7C5CE7 | Gradient end |
| Sage Green | #84A98C | Secondary/success accent |
| Gold | #D4AF37 | Highlight/schedule accent |
| Glassmorphism | bg-white/[0.08] backdrop-blur-[20px] | Card style |

## Implemented Features

### Student Dashboard - "Modern Spiritual" Redesign (Mar 18, 2026) - COMPLETED
- [x] Full-screen immersive purple gradient atmosphere
- [x] "Iris Flower" layout: 5 glassmorphism petal cards (Schedule, Profile, Soul Compass, Sacred Exchange, Reflection, Galaxy of Magic)
- [x] SVG progress ring (Soul Compass) showing session completion percentage
- [x] Tier-based sidebar navigation with lock icons for restricted features
- [x] Dual-theme sidebar: translucent purple (sanctuary mode) vs white (sub-pages)
- [x] Floating orbs and subtle animations (petalIn, fadeSlideUp, float)
- [x] Customizable greeting from admin Sanctuary Design tab
- [x] Responsive mobile layout with stacked cards
- [x] Video upload option added to Sanctuary Settings admin tab
- [x] All 8/8 backend + 100% frontend tests passed (iteration_74)

### Google OAuth Authentication (Mar 18, 2026) - COMPLETED
- [x] Emergent-managed Google Auth integration
- [x] Whitelist-only access: users must exist in Client Garden
- [x] Tier assignment based on client label (Dew/Seed=1, Root/Bloom=2, Iris/Purple Bees=4)
- [x] Session-based authentication with HttpOnly cookies
- [x] Login page with "Student Sanctuary" branding

### Student Profile & Financials (Mar 18, 2026) - COMPLETED
- [x] Detailed profile form (name, gender, DOB, location, profession, etc.)
- [x] Profile changes submitted for admin approval
- [x] Financial overview page with payment status, EMI tracking
- [x] Admin profile approvals endpoint

### Trust Section Final Design (Mar 17, 2026) - COMPLETED
### Personal Sessions Admin Page Refactor (Mar 17, 2026) - COMPLETED
### Trust Section Full Implementation (Mar 17, 2026) - COMPLETED
### Excel Export Restructure & Admin Guide (Mar 17, 2026) - COMPLETED
### Hero Background Image Upload for All Pages (Mar 17, 2026) - COMPLETED
### Unified Testimonial Displays Across Site (Mar 16, 2026) - COMPLETED

## Upcoming Tasks
- **P0:** Build out Student Dashboard sub-pages (Upcoming Sessions, Growth Roadmap, Mini Diary, Monthly Reports)
- **P1:** Manual Client Database Upload (Excel/CSV import for admin)
- **P1:** RBAC Middleware (backend route protection based on 4 tiers)
- **P2:** Admin command center for managing student tiers & payment statuses

## Future/Backlog Tasks
- Razorpay integration for Indian payments
- Advanced progress visualization charts (Past vs Present)
- Interactive tools (Calendar sync, Report submission portal)
- WhatsApp automation (auto-send group invite after payment)
- On-page SEO implementation
- Experience Sharing community feature
- Workshop Archive for higher-tier users
- Resource Vault for Iris-tier users

## Technical Debt
- Deduplicate `create_checkout_no_adaptive` function (exists in both payments.py and enrollment.py)
- TrustSection.jsx is hidden but still exists in codebase
- CheckoutPage.jsx may be unused (investigate)

## 3rd Party Integrations
- Stripe (Payments)
- Google Workspace (SMTP for emails)
- ipinfo.io (Geolocation)
- openpyxl (Excel export)
- lucide-react (Icons)
- Emergent-managed Google Auth (Student login)

## Key DB Schema
- **site_settings**: `{ sanctuary_settings: {hero_bg, hero_video, hero_overlay, greeting_title, greeting_subtitle}, dashboard_settings: {title, primaryColor, ...} }`
- **users**: `{ id, email, name, picture, role, tier, client_id, profile_approved, pending_profile_update }`
- **sessions (auth)**: `{ token, user_id, email, created_at, expires_at }`
- **clients**: `{ id, name, email, label, payment_status, active_package }`
- **journey_logs**: `{ id, client_id, date, title, category, experience, learning, rating }`

## Admin Credentials
- URL: /admin
- Username: admin
- Password: divineadmin2024

## Student Dashboard Access
- URL: /login → /dashboard
- Auth: Google OAuth (must be in Client Garden)
- Test user: test@divineiris.com (Priya Sharma, Tier 4 Iris)

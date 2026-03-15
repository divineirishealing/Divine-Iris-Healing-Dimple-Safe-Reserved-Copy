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

### Enrollment Form Enhancements + Excel Export (Mar 15, 2026) - COMPLETED
- [x] Added 7 new relationships: Son, Daughter, Grandmother, Grandfather, Grandson, Granddaughter, Relative
- [x] Online mode forces notify mandatory (golden message, no checkbox)
- [x] Replaced first-time checkbox with two-button selector: "First time joining Divine Iris" / "I am Divine Iris Soul Tribe"
- [x] "How did you hear?" dropdown only shown for first-timers, hidden for Soul Tribe
- [x] Removed "Returning Client" from referral sources
- [x] Both Inbox and Client Garden exports switched to .xlsx Excel format with styled headers and color-coded rows
- [x] All 15/15 tests passing (iteration 60)

### Hero Section Typography Overhaul (Feb 2026) - COMPLETED
- [x] 25+ fonts across 3 categories: Elegant/Serif, Modern/Sans, Handwriting/Script
- [x] Handwriting fonts: Great Vibes, Dancing Script, Pacifico, Sacramento, Alex Brush, Kaushan Script, Satisfy, Allura, Caveat
- [x] Titillium Web added to ALL font controls across entire admin panel
- [x] Glossy/shiny color effects: Gold Shimmer, Purple Glow, Gold-Purple Mix, Silver Chrome, Rose Gold, Rainbow (CSS gradient text)
- [x] Size options expanded from 3 to 8 levels (XS to 4XL)
- [x] Layout controls: Horizontal Align, Vertical Position, Title-Subtitle Gap, H/V Offset
- [x] Letter Spacing, Text Shadow (none/subtle/medium/strong/gold glow), Bold/Italic toggles
- [x] Live preview in admin for both title and subtitle
- [x] Decorative lines toggle

### Manual/Cash Payment Option (Feb 2026) - COMPLETED
- [x] 3 payment options for India users: Stripe (International), Exly/Bank Transfer, Submit Manual Payment
- [x] Manual mode navigates to /india-payment/:id?mode=manual — hides Exly tab, shows proof form directly
- [x] Payment method dropdown: Bank Transfer, UPI, Cash Deposit, Cheque, Other
- [x] Notes/additional details textarea on proof form
- [x] Pricing: Base - 9% alt discount + 18% GST (on full base) + 3% platform charges
- [x] india_platform_charge_percent added to SiteSettings (default 3%)
- [x] Admin approves/rejects via India Proofs tab — approved → receipt email sent, rejected → start over
- [x] All tests passed (iteration_61.json): 11/11 backend, all frontend verified

### Enrollment Receipt Email Overhaul (Feb 2026) - COMPLETED
- [x] Changed "STATUS" column header → "MEMBER STATUS"
- [x] Changed "First session" / "Returning" → "First Time Joiner" / "Soul Tribe"
- [x] Replaced warm golden/yellow email backgrounds with calming sage-green palette throughout receipt and notification templates
- [x] Added "Important Note" section — editable from Receipt Template admin tab (default: Zoom link info)
- [x] Added "Need Assistance?" section with WhatsApp button (+971553325778) and Contact Form link
- [x] Tier-aware duration: stores tier_index in transactions, uses tier label (e.g., "1 Month") as duration in emails
- [x] Added WhatsApp + Zoom + Custom link fields to Programs Hub as dedicated "Session Links" section below table
- [x] WhatsApp Community Group is now GLOBAL (stored in site_settings, shared across all programs/sessions/enquiries)
- [x] Per-program links: WhatsApp Workshop Group, Zoom Meeting, Custom Link (with toggles)
- [x] Custom link label is editable (admin can name it anything)
- [x] Labels: "WhatsApp Workshop Group" and "WhatsApp Community Group"
- [x] Attachments & Resources in Receipt Template — upload documents (PDF, DOCX, etc.) or add video/external links; rendered as download buttons in receipt email
- [x] Updated both enrollment_confirmation_email and participant_notification_email color schemes

### Client Garden CRM (Mar 15, 2026) - COMPLETED
- [x] Backend: clients collection with unique email/phone deduplication
- [x] Sync/backfill from all touchpoints: contacts, interests, questions, enrollments, payment transactions
- [x] 7-tier garden label hierarchy: Dew → Seed → Root → Bloom → Iris → Purple Bees → Iris Bees
- [x] Auto-label assignment based on conversion data (workshops, flagship, multiple, annual)
- [x] Manual label override with auto-recompute when cleared
- [x] Search by name/email/phone, filter by label
- [x] Expandable client profiles with: info grid, sources, conversions list, journey timeline, notes
- [x] Export all client data as CSV
- [x] All 31/31 tests passing (iteration 59)

### Admin Inbox — Contact, Interest & Questions Management (Mar 15, 2026) - COMPLETED
- [x] Backend: `/api/inbox/contacts`, `/api/inbox/interests`, `/api/inbox/questions` GET endpoints
- [x] Backend: Status update (read/replied), delete, and unified reply endpoint with rich email
- [x] Reply emails include: custom message, optional upcoming program cards, WhatsApp community link, workshop subscription, auto social links
- [x] Workshop subscription toggle auto-adds recipient to newsletter subscribers
- [x] Frontend: Inbox tab in admin with 3 section tabs (Contact Form, Express Interest, Questions) + counts
- [x] Expandable items with detail view, message history, and reply composer
- [x] 4 toggle options: Attach Programs, WhatsApp Community, Future Workshops, Social Links
- [x] Filters (All/New/Replied) and search by name/email/message
- [x] All 28/28 tests passing (iteration 58)

### Logo Moved to Header (Mar 15, 2026) - COMPLETED
- [x] Site logo moved to top-left corner of header navigation, visible and clickable (navigates home)
- [x] LogoSection removed from homepage
- [x] Logo also shows in mobile menu

### About Page Hero Admin Controls + Pricing Hub Fix (Mar 15, 2026) - COMPLETED
- [x] Hero section controls in About admin tab: logo image (upload/visibility/size), title (text/alignment/visibility/font), subtitle (text/alignment/visibility/font), divider line (visibility/color/width/thickness)
- [x] Removed static logo from About page bio section
- [x] About page hero renders dynamically from page_heroes.about settings with conditional visibility and alignment
- [x] Pricing Hub: Fixed input focus loss bug by moving Cell component outside PricingHubTab (uses local state + onBlur)
- [x] All 22/22 tests passing (iteration 57)

### Footer Links & Exclusive Offer Feature (Mar 15, 2026) - COMPLETED
- [x] Footer links: Home → /#home (hero section), Upcoming Sessions → /#upcoming, Services → /sessions
- [x] All footer/header links scroll to section TITLE (with -60px offset for fixed header), not bottom
- [x] Non-hash links scroll to top of destination page
- [x] Header: Animated golden "GRAB NOW" pill badges on configurable menu items (replaces boring dot)
- [x] Badge: Gold gradient, sparkle icon, subtle pulse animation — draws attention
- [x] Hover tooltip: Shows countdown only when end date is set (optional)
- [x] Admin: End date marked as optional in UI
- [x] Backend: `exclusive_offer` field — end_date no longer required

### Contact Page Redesign (Mar 14, 2026) - COMPLETED
- [x] Hero: "Get in Touch" with gold subtitle and gold divider
- [x] Three info blocks: Email Us, WhatsApp, Follow Us (white cards, gold top border, gold icons, social circles)
- [x] Form: "Send us a Message" with gold underline
- [x] Name + Email in same row
- [x] Phone (mandatory, with country code auto-populated via geolocation) + WhatsApp (optional) in same row
- [x] Program interest + Session interest dropdowns side by side (populated from DB)
- [x] Message textarea, dark "Send Message" button centered
- [x] Cream/beige (#f8f5f0) background throughout
- [x] After submit: "We will respond within 7-10 days"
- [x] Removed "Other Ways to Reach Us" section
- [x] Footer contact dialog updated to match same form style
- [x] All 21/21 frontend tests passing (iteration 56)

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

### P0: Manual Client Management & Excel Upload
- Allow manually editing client labels (tag as Iris, Iris Bee, etc.)
- Upload Excel file of existing clients to bulk-populate Client Garden

### P1: Annual Subscriber Dashboard
- Design/feature set for managing "Iris" (Annual Program Subscriber) clients

### P2: User Verification for Programs Hub & Pricing Hub
- Major refactor from previous session pending user review

### P3: Global & Testimonial Search
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

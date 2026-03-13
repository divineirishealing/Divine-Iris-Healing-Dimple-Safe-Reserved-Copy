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

### Sponsor Contribution Form + Payment Gateway (Mar 12, 2026)
- [x] "Become a Sponsor" button → reveals full contribution form
- [x] Form: Full Name, Email + Verify, Amount with auto-detected currency badge, Message, Anonymous checkbox
- [x] "Proceed to Payment" → Stripe checkout via /api/payments/sponsor-checkout
- [x] Transaction stored with item_type='sponsor' in payment_transactions
- [x] Sponsor hero title/subtitle editable via Page Headers admin tab
- [x] About page section title fonts editable: Philosophy, Impact, Mission & Vision titles
- [x] Sponsor row added to Page Headers tab

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

### Sessions Admin Font Controls & Calendar (Mar 12, 2026)
- [x] Inline font controls (color, family, size, bold, italic) for Title and Description — always visible, not hidden
- [x] Interactive calendar in admin for toggling available dates — click to toggle, visual feedback
- [x] Quick-fill buttons: "Fill 30 Days (Mon-Fri)" and "Fill 60 Days" + "Clear All"
- [x] Min 7 days advance booking enforced on all calendars (admin, homepage, detail page)
- [x] Sat/Sun auto-disabled with red visual indicators on all calendars
- [x] Date count and time slot count shown in session list rows

### Sessions Section Redesign (Mar 12, 2026)
- [x] Iris purple gradient background (vibrant, inviting design)
- [x] Session list on left with mode badges (Online/Offline/Both) and duration
- [x] Click session → detail panel: title, description, mode, pricing, calendar, testimonial, Book button
- [x] Interactive mini calendar with available dates highlighting
- [x] Testimonial snippet (2-5 lines) per session, rendered with markdown
- [x] Session mode: online / offline / both with admin radio controls
- [x] Time slots management in admin (add/remove)
- [x] Font controls for session title & description in admin
- [x] Removed images from sessions (no longer required)
- [x] Session Detail Page: purple gradient hero, calendar, time slots, book button
- [x] All Sessions Page: purple gradient, cards without images, mode badges

### Homepage UI/UX Refinements (Mar 12, 2026)
- [x] Reduced vertical spacing between all homepage sections (py-20 → py-12)
- [x] Enhanced Custom Sections: image upload, body text with markdown, body font controls
- [x] No golden border on custom sections — clean white background
- [x] Admin can add custom sections with full content control (title, subtitle, image, body text, all font styles)

### Unified Program Page Template (Feb 2026)
- [x] Single "Program Page Template" in admin Page Headers tab controls all program detail pages
- [x] Template styles: Hero Title, Hero Subtitle, Section Titles, Section Subtitles, Body Text, CTA/Pricing Text
- [x] Hero Background color and Gold Line / Accent color pickers
- [x] All flagship program detail pages read from settings.page_heroes.program_template
- [x] Per-program content (title, description, sections) still comes from each program's own data
- [x] Old per-program hero keys deprecated (no longer consumed by frontend)
- [x] 9/9 backend tests passing, 100% frontend verification

### Program Admin Restructure & Section Template (Feb 2026)
- [x] Global Section Template: defines section structure (types, order) for ALL program pages — managed in Page Headers tab
- [x] Default 4 sections auto-seeded: The Journey, Who It Is For?, Your Experience (Dark BG), Why You Need This Now?
- [x] Admin Programs tab split into Part 1 (Homepage Card & General) and Part 2 (Page Content)
- [x] Part 2: Template-driven section editor — only title/subtitle/body text fields per program
- [x] Image upload shown ONLY for "experience" (dark BG) sections — hidden for all other section types
- [x] Per-section font controls removed — all font styling handled by global program_template
- [x] ProgramDetailPage: uses global section template for structure, per-program data for content
- [x] Homepage: "Know More" button added to all flagship program cards (gold outline, below Enroll/Cart)
- [x] 9/9 backend tests passing, 100% frontend verification

### Session Extras & Redesign (Mar 2026)
- [x] Unified Calendar Manager: single calendar for all sessions with block/open rules, quick actions (Block 1/2/3 weeks, Open weekdays +1/2 months)
- [x] Time slots managed globally (10:00 AM, 2:00 PM, 5:00 PM default)
- [x] Calendar rules: min advance days, max future months, block weekends
- [x] Session Testimonials: CRUD API, admin management, Excel drag-drop upload, client photo support
- [x] Session Questions: visitors submit questions from session pages, admin replies from panel + email
- [x] Question form with "7 working days" response note
- [x] Session Detail Page redesign: iris purple glossy hero with golden star particles, purple gradient booking section with animated golden waves
- [x] Personal Sessions — Shared Styles in Page Headers tab (6 font controls)
- [x] Excel upload for sessions (drag & drop)
- [x] 17/17 backend tests passing, 100% frontend verification

### Personal Sessions Design Tweaks (Mar 13, 2026)
- [x] Admin controls: Purple intensity dropdowns (light/medium/strong) for homepage and session detail page
- [x] Homepage sessions section: background gradient driven by `session_template.homepage_purple` setting
- [x] Homepage sessions section: gold dust particle dots removed
- [x] Homepage sessions section: session titles use shared `session_template.title_style`
- [x] Session detail page hero: gradient driven by `session_template.page_purple` setting
- [x] Session detail page hero: star count dynamic (50/80/100 for light/medium/strong)
- [x] Session detail page body: changed from dark theme to soft purple gradient (matching homepage sessions section)
- [x] Session detail page body: gradient intensity synced with admin `page_purple` setting
- [x] Session detail page: info cards, testimonials, question form all use light purple theme
- [x] Session detail page: booking sidebar retains dark purple gradient
- [x] 15/15 frontend tests passing, 100% verification

### Session Visibility Control Panel (Mar 13, 2026)
- [x] New `SessionVisibilityPanel.jsx` admin component with 4 configurable areas
- [x] Homepage Session List: toggle/reorder session name, type, duration (type & duration OFF by default)
- [x] Homepage Selected Session Detail: toggle/reorder 9 elements (badges, title, desc, testimonial, price, calendar, time slots, book button)
- [x] Session Page Hero: toggle/reorder 6 elements (back button, type badge, duration, title, gold line, price)
- [x] Session Page Body: toggle/reorder 5 elements (about, testimonials, info cards, booking sidebar, question form)
- [x] Unified control — applies to all sessions uniformly, stored in session_template.visibility
- [x] Frontend components updated to consume visibility/order settings with smart defaults
- [x] Save Visibility Settings button in admin Sessions tab
- [x] 25/25 frontend tests passing, 100% verification

### Session Style Control Panel Overhaul (Mar 13, 2026)
- [x] Added Titillium Web font to Google Fonts and all admin font dropdowns
- [x] Redesigned admin "Personal Sessions — Style Control" with 5 clear visual sections:
  - Hero Section (dark purple bg): title font, price text, badge BG/text colors, hero BG color, purple intensity, accent/line color, star color
  - Body Content (white bg): section title, description, testimonial fonts
  - Buttons: primary color, text color, quick presets (Gold, Coal Black, Purple, Deep Iris)
  - Calendar & Booking: accent color, BG color, homepage purple intensity
  - Homepage Session List: session name font, price style
- [x] Preview labels on each section ("Preview: Top banner of every session page" etc.)
- [x] Fixed invisible badges — now use admin-controlled colors with proper contrast
- [x] Session detail page, homepage buttons, calendar all consume admin color settings
- [x] 28/28 frontend tests passing, 100% verification

### Body Content Font Controls & Editable Info Cards (Mar 13, 2026)
- [x] Added 3 new font controls to Body Content: "What Clients Say" Heading, Info Card Heading, Info Card Bullet Text
- [x] Made info cards fully editable from admin: Card 1 & Card 2 titles + bullet points (one per line)
- [x] Session detail page dynamically renders card titles and bullets from admin settings
- [x] 12/12 frontend tests passing, 100% verification

### Add to Cart for Personal Sessions (Mar 13, 2026)
- [x] Added `addSessionItem` to CartContext — stores session with selected date/time slot
- [x] Homepage sessions: "Add to Cart" outlined button below "View Details & Book", selectable time slots
- [x] Session detail page: "Add to Cart" outlined button below "Book Now", selectable time slots  
- [x] Cart page: session items show "Personal Session" badge + duration + date + time
- [x] Toast notifications for add/duplicate, cart icon count updates
- [x] Admin-controlled button colors applied to both cart buttons
- [x] 15/15 frontend tests passing, 100% verification

### Missing Admin Text Controls (Mar 13, 2026)
- [x] Added "Book Your Session" heading font control to Calendar & Booking section
- [x] Added "Ask a Question" heading font control + Question Form Labels to Body Content
- [x] Added editable "Question Form Intro Text" field
- [x] Added editable "Choose Your Healing Journey" placeholder title + font + subtitle + font to Homepage Session List

### Special Offers System + Footer/Header Fixes (Mar 13, 2026)
- [x] Per-session offers: offer_price_aed/usd/inr, offer_text badge, offer_expiry in session form
- [x] Global offer system: badge text, colors, expiry, quick presets (Limited Time Offer, Early Bird, etc.)
- [x] Strike-off pricing on homepage and detail page (original crossed out, offer highlighted)
- [x] Offer badges with pulse animation, auto-removed when expiry passes
- [x] Footer/Header menu sorted by length (shortest→longest), capitalized each word
- [x] Footer programs sorted by title length, SERVICES → #sessions, MEDIA → /media
- [x] Editable booking footer note text
- [x] 18/18 frontend tests passing, 100% verification

## Backlog
### P1
- [ ] Global Site Search
- [ ] Testimonial keyword search
- [ ] Video testimonial support (YouTube embed management)
- [ ] Reply to Questions (admin panel UI)

### P2
- [ ] User login & subscriber dashboard
- [ ] Replace mock phone OTP
- [ ] Mobile responsiveness audit

### P3
- [ ] Anti-fraud geo-pricing, SEO, Admin analytics, Bulk export
- [ ] PageHeadersTab.jsx refactoring (split into smaller components)

## Admin: admin / divineadmin2024
## Test: 6 programs, EARLY50/NY2026 promos, OTP MOCKED, Stripe TEST

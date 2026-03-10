# Divine Iris Healing - Product Requirements Document

## Original Problem Statement
Build a pixel-perfect clone of https://divineirishealing.com/ - a wellness/healing website. Requirements include:
- Exact replica of design, layout, colors, fonts, images, animations
- Admin panel for non-technical user to manage content (programs, sessions, testimonials)
- Image upload functionality
- Stripe payment gateway (test mode) with multi-currency support

## Architecture
- **Frontend**: React + TailwindCSS + shadcn/ui
- **Backend**: FastAPI + Motor (async MongoDB)
- **Database**: MongoDB
- **Fonts**: Configurable via admin (default: Playfair Display headings, Lato body)
- **Color scheme**: Configurable via admin (default: Gold #D4AF37)

## What's Been Implemented

### Phase 1 & 2 - Visual Fidelity & Bug Fixes (COMPLETED - Feb 2026)
- [x] Playfair Display + Lato fonts integrated globally
- [x] Hero section, About section, golden menu overlay, footer with programs
- [x] Image upload/display bug FIXED
- [x] Admin logout on refresh FIXED

### Phase 3 - Enhanced Admin Panel (COMPLETED - Feb 2026)
- [x] **Visibility Toggle**: Show/hide programs, sessions, testimonials on public site
- [x] **Reordering**: Up/down arrow controls to rearrange display order
- [x] **Site Settings**: Global font, color, and size customization (Cinzel, Caveat, Playfair Display, Montserrat, etc.)
- [x] Programs CRUD with image upload, pricing, category
- [x] Sessions CRUD with image upload, pricing
- [x] Testimonials management (graphic images + video YouTube) with text for search indexing
- [x] Subscribers list, Stats view

### Phase 4 - Personal Sessions (COMPLETED - Feb 2026)
- [x] **21 sessions** from original site seeded with real images/descriptions
- [x] Services page with sidebar layout (session list left, detail right)
- [x] Clicking session shows detail with image, description, "View Details & Book" button

### Phase 5 - Transformations Page (COMPLETED - Feb 2026)
- [x] 44 testimonials (32 graphic + 12 video) from original site
- [x] **Real-time search** across testimonial text and names
- [x] **Tab filtering**: All / Graphic / Video
- [x] Image lightbox for graphic testimonials
- [x] YouTube video modal for video testimonials
- [x] Added to footer and navigation menu

### Backend APIs
- Programs CRUD + visibility toggle + reorder: /api/programs
- Sessions CRUD + visibility toggle + reorder: /api/sessions
- Testimonials CRUD + search + type filter + visibility: /api/testimonials
- Site Settings: GET/PUT /api/settings
- Stats, Newsletter, Image Upload/Serving, Payments, Currency

### Admin Credentials
- URL: /admin
- Username: admin
- Password: divineadmin2024

## Prioritized Backlog

### P0 - High Priority
- [ ] Complete Stripe payment flow (end-to-end with test key)
- [ ] Multi-currency detection on frontend (based on user's country/IP)

### P1 - Medium Priority
- [ ] "Express Your Interest" → contact page with pre-filled program name
- [ ] Media page with video content from original site

### P2 - Low Priority
- [ ] Full responsiveness audit on mobile
- [ ] SEO meta tags
- [ ] Transactions view in admin panel

### P3 - Future
- [ ] Email notifications for admin
- [ ] Analytics dashboard

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
- **Fonts**: Playfair Display (headings), Lato (body)
- **Color scheme**: Gold (#D4AF37), Dark backgrounds, White sections

## What's Been Implemented (Feb 2026)

### Phase 1 & 2 - Visual Fidelity & Bug Fixes (COMPLETED)
- [x] Playfair Display + Lato fonts integrated globally
- [x] Hero section with Divine Iris logo, dark gradient background, golden "ETERNAL HAPPINESS"
- [x] About section with real Dimple Ranawat photo from original site
- [x] Golden full-screen menu overlay (matching original site)
- [x] Header with MENU hamburger + social icons
- [x] Programs section with DB-backed cards + uploaded image support
- [x] Sessions section with tab navigation + detail view + card grid
- [x] Stats section (gold numbers on dark background)
- [x] Testimonials section with YouTube video carousel + play overlay
- [x] Newsletter subscription section
- [x] Footer with Menu, Programs, Contact columns
- [x] Floating email + WhatsApp buttons
- [x] Sponsor section with original site image
- [x] Transformations page with 24 testimonial image cards
- [x] Services page with sidebar layout (session list + detail)
- [x] Program detail page with hero, content, "Your Experience", CTA, testimonials
- [x] Session detail page
- [x] All Programs + All Sessions listing pages
- [x] Contact page with form
- [x] **Image upload/display bug FIXED** - relative URL storage + resolveImageUrl utility
- [x] **Admin logout on refresh bug FIXED** - localStorage persistence
- [x] Admin panel with tabs: Transactions, Programs, Sessions, Testimonials, Stats, Subscribers

### Backend APIs
- Programs CRUD: GET/POST/PUT/DELETE /api/programs
- Sessions CRUD: GET/POST/PUT/DELETE /api/sessions
- Testimonials CRUD: GET/POST/DELETE /api/testimonials
- Stats CRUD: GET/PUT /api/stats
- Newsletter: GET/POST /api/newsletter
- Image Upload: POST /api/upload/image
- Image Serving: GET /api/image/{filename}
- Payments: POST /api/payments/checkout, GET /api/payments/status/{id}, GET /api/payments/transactions
- Currency Detection: GET /api/currency/detect

### Admin Credentials
- URL: /admin
- Username: admin
- Password: divineadmin2024

## Prioritized Backlog

### P0 - High Priority
- [ ] Complete Stripe payment flow testing (end-to-end with test key)
- [ ] Multi-currency detection on frontend (based on user's country/IP)
- [ ] Wire "Pay Now" buttons to Stripe checkout with currency selection

### P1 - Medium Priority
- [ ] "Express Your Interest" button → contact page with pre-filled program name
- [ ] Expand admin panel for all content sections (sponsor text, about text, etc.)
- [ ] Media page with video content from original site

### P2 - Low Priority  
- [ ] Full responsiveness audit on mobile devices
- [ ] SEO meta tags for all pages
- [ ] Performance optimization (lazy loading, image compression)

### P3 - Future
- [ ] Email notifications for admin on new subscriptions/inquiries
- [ ] Analytics dashboard in admin panel

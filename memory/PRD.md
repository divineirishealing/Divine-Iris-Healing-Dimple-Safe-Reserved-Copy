# Divine Iris Healing - Product Requirements Document

## Original Problem Statement
Build a pixel-perfect clone of https://divineirishealing.com/ with a comprehensive, child-friendly admin panel to manage all website content and styling, plus a robust enrollment and payment system with anti-fraud India-gating.

## Architecture
- **Frontend**: React + TailwindCSS + shadcn/ui
- **Backend**: FastAPI + Pydantic + Motor (async MongoDB)
- **Database**: MongoDB
- **Payments**: Stripe (test mode) via emergentintegrations
- **Email**: Resend (configured, pending domain verification)

## What's Been Implemented

### Comprehensive Admin Panel (COMPLETED - Mar 2026)
- [x] **11 Admin Tabs** — modular, each section fully editable:
  1. **Hero Banner** — Video upload, title (font/size/color/bold/italic/alignment), subtitle, decorative lines toggle, live preview
  2. **About** — Site logo (upload + size slider), healer photo, name, title, 2 bio paragraphs, button text/link
  3. **Programs** — Full CRUD, visibility toggle, reorder, pricing (AED/USD/INR), offers, upcoming toggle
  4. **Sessions** — Full CRUD, visibility, reorder, multi-currency pricing
  5. **Testimonials** — Full CRUD, graphic/video types, visibility toggle
  6. **Stats** — Full CRUD (add/edit/delete numbers like "28000+ Clients")
  7. **Newsletter** — Heading, description, button text, footer text with live preview
  8. **Header & Footer** — Social media URLs (Facebook, Instagram, YouTube, LinkedIn), footer brand name, tagline, email, phone, copyright with preview
  9. **Enrollments** — View all enrollments with participants, toggle to Payments view, search
  10. **Subscribers** — Email list with dates
  11. **Global Styles** — Heading/body font selectors, color pickers, text sizes, per-section style overrides
- [x] **Dynamic Content** — Header, Footer, About, Newsletter sections consume settings from API (no more hardcoded values)

### Multi-Person Enrollment v2 (COMPLETED - Mar 2026)
- [x] 3-step flow: Participants → Verify → Pay
- [x] Per-participant: country, attendance mode (Online Zoom / Remote Healing), notification toggle (email + phone)
- [x] Booker verification: email format + phone OTP
- [x] Price multiplied by participant count

### Email Notifications (COMPLETED - Mar 2026)
- [x] Resend integration configured (API key set)
- [x] Booker confirmation email — branded HTML with participants, amounts, modes
- [x] Participant notification email — for those who opted in
- [x] Triggered automatically post-payment via background task
- [x] **Pending:** Domain verification in Resend for custom sender email

### Anti-Fraud India-Gating (COMPLETED)
- [x] VPN/proxy detection, IP validation, phone prefix check, BIN validation
- [x] INR pricing only if ALL checks pass, else AED (with USD fallback if AED=0)

### Pixel-Perfect Site Clone (COMPLETED)
- [x] Hero section with video background, custom particle canvas animation (Stats)
- [x] All pages: Home, About, Services, Programs, Sessions, Media, Contact
- [x] Admin credentials: `/admin` | admin / divineadmin2024

## Key API Endpoints
- `GET/PUT /api/settings` — All site settings (hero, about, newsletter, footer, social, styles)
- `GET/POST/PUT/DELETE /api/programs` — Programs CRUD
- `GET/POST/PUT/DELETE /api/sessions` — Sessions CRUD
- `GET/POST/PUT/DELETE /api/testimonials` — Testimonials CRUD
- `GET/POST/PUT/DELETE /api/stats` — Stats CRUD
- `GET /api/enrollment/admin/list` — Admin: all enrollments
- `GET /api/payments/transactions` — Admin: all payments
- `POST /api/enrollment/start` — Start enrollment with per-participant data
- `POST /api/enrollment/{id}/send-otp` — Mock OTP
- `POST /api/enrollment/{id}/checkout` — Stripe checkout

## Prioritized Backlog

### P0 - High Priority
- [ ] Verify Resend domain for live email sending
- [ ] Replace mock phone OTP with real provider (Twilio/Firebase)

### P1 - Medium Priority
- [ ] Mobile responsiveness audit
- [ ] SEO meta tags
- [ ] Admin: bulk export enrollments (CSV)

### P2 - Low Priority
- [ ] Re-upload graphic testimonial images to local storage
- [ ] Admin: analytics dashboard (enrollment trends, revenue)

## 3rd Party Integrations
- **Stripe** — Payments (test mode, via emergentintegrations)
- **Resend** — Email notifications (configured, domain pending)
- **ipinfo.io / ip-api.com** — VPN/proxy detection
- **binlist.net** — Card BIN validation
- **FontAwesome** — Icons (CDN)

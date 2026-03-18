# Divine Iris Student Growth Platform - Design & Technical Proposal

## Executive Summary
This document outlines the architecture and design for upgrading the Divine Iris platform into a **Multi-Tiered Student Growth Platform**. The system will introduce robust User Authentication, Role-Based Access Control (RBAC), and a personalized "Student Sanctuary" dashboard that adapts to the user's journey (New -> Workshop Grad -> 3-Month -> Annual Subscriber).

---

## 1. User Architecture & RBAC (Role-Based Access Control)

### Tiers & Permissions
We will implement a 4-Tier system. Access is cumulative (Tier 2 includes Tier 1).

| Tier | Name | Access Rights |
| :--- | :--- | :--- |
| **Tier 1** | **NEW** (The Seeker) | • **Read-Only:** Upcoming Sessions, Community Wall.<br>• **UI:** "Growth Roadmap" with locked steps to encourage upgrade. |
| **Tier 2** | **WORKSHOP_GRAD** (The Initiate) | • **All Tier 1** +<br>• **Write:** "Experience Sharing" (Community Posts).<br>• **Read:** "Workshop Archive" (Video Library). |
| **Tier 3** | **3-MONTH** (The Explorer) | • **All Tier 2** +<br>• **Write:** "Mini Diary" (Private), "Report Portal" (Monthly Submissions).<br>• **Analytics:** Past vs. Present Growth Chart. |
| **Tier 4** | **ANNUAL** (The Iris) | • **All Tier 3** +<br>• **Full Access:** 12-Month AWRP Tracker, 6-Month MMM Map.<br>• **Downloads:** Quarterly Release Vault, Bi-annual Center. |

### Authentication Strategy
*   **JWT (JSON Web Tokens):** Secure, stateless authentication.
*   **Dual-Collection Model:**
    *   `users` collection: Handles login credentials (email, password hash) and system access (role, tier).
    *   `clients` collection: Retains existing CRM data (programs, history, "Garden" label).
    *   *Link:* The `users` document will link to the `clients` document via `client_id`.

---

## 2. Database Schema (MongoDB)

### New Collections

**1. `users`** (Authentication & Access)
```json
{
  "_id": "ObjectId",
  "email": "user@example.com",
  "password_hash": "...",
  "role": "student", // or "admin"
  "tier": 1, // 1=New, 2=Grad, 3=3-Month, 4=Annual
  "client_id": "UUID-of-existing-client-record",
  "created_at": "ISO-Date"
}
```

**2. `diary_entries`** (Zen Diary)
```json
{
  "_id": "ObjectId",
  "user_id": "ObjectId",
  "date": "2025-12-25",
  "content": "Today I felt...",
  "mood": "Peaceful", // Optional tag
  "created_at": "ISO-Date"
}
```

**3. `progress_reports`** (Monthly Submission)
```json
{
  "_id": "ObjectId",
  "user_id": "ObjectId",
  "month": "2025-12",
  "metrics": {
    "inner_peace": 8,
    "physical_energy": 6,
    "emotional_balance": 7,
    "consistency": 9
  },
  "file_url": "https://...", // Uploaded report PDF/Doc
  "status": "submitted",
  "feedback": "Great progress!", // Admin feedback
  "created_at": "ISO-Date"
}
```

**4. `community_posts`** (Experience Sharing)
```json
{
  "_id": "ObjectId",
  "user_id": "ObjectId",
  "content": "My experience with the workshop was...",
  "status": "pending", // pending -> approved -> rejected
  "likes": 0,
  "created_at": "ISO-Date"
}
```

---

## 3. Financial & Geo-Logic

*   **Payment Ledger:** A unified view in the Dashboard > Settings > Billing.
*   **Logic:**
    *   **India (INR):** Detected via IP + Timezone + Phone (+91). Uses **Razorpay** (UPI/Netbanking).
    *   **Global (USD):** Default for all others. Uses **Stripe**.
*   **Data Source:** The existing `enrollments` and `payment_transactions` collections will be queried to build the "Payment Ledger" view (EMI status, Due Dates).

---

## 4. Design System: "Modern Spiritual"

### Visual Identity
*   **Primary Color:** Iris Purple `#5D3FD3` (Spiritual depth, royalty).
*   **Secondary Color:** Sage Green `#84A98C` (Growth, healing, success states).
*   **Backgrounds:** Soft, off-white/cream `#F9F9F9` or subtle gradients.
*   **Typography:**
    *   *Headings:* `Playfair Display` or `Cinzel` (Elegant Serif).
    *   *Body:* `Lato` or `Inter` (Clean Sans-Serif).

### UI Components (Glassmorphism)
*   **Glass Card:** Translucent white background (`rgba(255, 255, 255, 0.7)`), backdrop blur (`10px`), thin white border. Used for Diary, Report Upload, and Charts.
*   **Zen Button:** Pill-shaped, soft shadow, subtle gradient hover.
*   **Radar Chart:** A spider-web chart comparing "Baseline" vs. "Current" metrics (Peace, Energy, Balance, Consistency).

### Layout (Responsive)
*   **Desktop:** Left Sidebar Navigation (collapsible). Main content area in a "Bento Grid" layout.
*   **Mobile:** Bottom Navigation Bar (Home, Diary, Connect, Profile).

---

## 5. Development Roadmap

### Phase 1: Foundation (Current Priority)
1.  **Auth API:** Implement Login/Signup endpoints and JWT middleware.
2.  **Database Migration:** Create `users` collection and link to existing `clients`.
3.  **Admin Upgrade:** Add "User Management" to Admin Panel to manually set Tiers.

### Phase 2: The Dashboard Shell
1.  **Frontend Setup:** Create `StudentDashboard` layout with Sidebar.
2.  **Tier Logic:** Implement `<PrivateRoute>` to lock/unlock sections based on Tier.

### Phase 3: Features & Tools
1.  **Diary & Reports:** Build the Zen Editor and Drag-and-Drop uploader.
2.  **Analytics:** Integrate Recharts for the "Transformation" Radar Chart.
3.  **Community:** Build the "Experience Sharing" feed with Moderation.

### Phase 4: Financial Integration
1.  **Ledger View:** Display transaction history.
2.  **Razorpay:** Integrate Razorpay for Indian users (currently only Stripe exists).

---

## 6. Next Steps
1.  **Approval:** Confirm this architecture aligns with your vision.
2.  **Execution:** Begin **Phase 1 (Foundation)** immediately.

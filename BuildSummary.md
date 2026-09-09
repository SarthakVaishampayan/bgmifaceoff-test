# BGFS — Battlegrounds Faceoff Series
## Comprehensive Platform Build Summary, Architecture Guide & Maintenance Playbook

---

## 📌 Executive Overview

**BGFS (Battlegrounds Faceoff Series)** is a full-stack, enterprise-grade BGMI (mobile) tournament management platform engineered with **Next.js 16 (App Router)**, **TypeScript**, **Supabase (PostgreSQL, RLS, Auth)**, and **Razorpay**.

The platform powers a **2-week competitive tournament cycle**:
- **Week 1 & 2 (Mon–Fri):** Paid league stage matches (3 matches/slot).
- **Week 2 (Sat–Sun):** **Free Grand Finals** for the top 16 qualified teams (3 matches Saturday + 3 matches Sunday).

---

## 🏗️ Architecture & System Connections

```
                             ┌──────────────────────────────────┐
                             │       NEXT.JS FRONTEND           │
                             │  (App Router, Vanilla CSS, RSC)  │
                             └────────────────┬─────────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
                    ▼                         ▼                         ▼
         ┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐
         │   SUPABASE AUTH   │     │ DATABASE & RLS    │     │  RAZORPAY GATEWAY │
         │ (Password & OTP)  │     │ (Postgres + Views)│     │(Order, Verify, Webhook)
         └───────────────────┘     └───────────────────┘     └───────────────────┘
```

---

## 🔑 Core Business Logic & Slot Booking Protocol

### 1. 20/20 Capacity & Slot Deduction System
- **Default Slot Capacity**: Every match slot initialized with `capacity = 20` and `teams_booked_count = 0`.
- **Spots Left Formula**: `spotsLeft = capacity - teams_booked_count`.
- **Badge Label Progression**:
  - `0 Booked`: `20/20 SPOTS LEFT`
  - `1 Booked`: `19/20 SPOTS LEFT`
  - `20 Booked`: `SLOTS FULL (0 LEFT)` with status set to `'full'`.
- **Automatic Capacity Locking**: Once `teams_booked_count >= capacity`, the button transitions to **`🔒 SLOTS FULL`** and disables further registration attempts.

### 2. Duplicate Booking & Time Conflict Safeguards
- **Per-Slot Lock**: Prevents a team from registering for the exact same `slot_id` twice.
- **Frontend Registered UI**: Upon booking, the slot card immediately transforms into a **Green "✓ REGISTERED"** card rendering match schedule, WhatsApp Join button, and Receipt modal trigger. The "Register" button is removed.
- **Backend Guard**: `/api/booking/create` validates existing `team_id` + `slot_id` entries and returns HTTP `409 Conflict` if already registered.

### 3. FCFS Room Slot Allocation (Starts at Slot 5)
- **First-Come, First-Served Rule**: Bookings automatically get assigned an in-game room slot number starting from **Slot 5** for that specific match (`room_slot_number = 5 + otherPaidCount`).
- **Visibility Across Views**:
  - **Player Ticket / Dashboard**: Displays `ROOM SLOT: SLOT 5` under time/date details.
  - **Leaderboard / Slot Standings**: Displays `Team Name [Slot 5]` and `ROOM SLOT: SLOT 5` badges.
  - **Admin Score Entry**: Dropdown helper displays `Team Name [Slot 5]` to simplify match score entry from room screenshots.

### 4. Cross-Account & Multi-Team Compatibility
- **All Team IDs Fetching**: Both `/slots/page.tsx` and `/dashboard/page.tsx` construct `allUserTeamIds` from `userProfile.team_id` AND `teams.captain_user_id = user.id`.
- **Legacy & New Account Compatibility**: Guarantees that prior accounts created before team schema updates see their full tournament history and slot bookings without missing dashboard entries.

---

## 🛡️ Database RLS Security Protocol & Service Role Client Standard

> [!IMPORTANT]
> **ROW-LEVEL SECURITY (RLS) FIX & MANDATORY RULE**
> 
> **Root Cause of `new row violates row-level security policy for table "bookings"`**:
> PostgreSQL's RLS policy on `bookings` evaluates:
> `WITH CHECK (team_id = (SELECT team_id FROM users WHERE user_id = auth.uid()))`
> If a user's record in `public.users` has `team_id = NULL` or is out-of-sync with `auth.uid()`, the user-authenticated client (`createClient()`) triggers an RLS violation.

### Solution Standard:
1. **Elevated Service Role Client**: ALL backend database writes to `bookings`, `teams`, `users`, and `coupons` inside `/api/` routes (`/api/booking/create`, `/api/coupon/redeem`, `/api/payment/verify`) MUST strictly use `createAdminClient()` (`SUPABASE_SERVICE_ROLE_KEY`). The Service Role client bypasses RLS completely.
2. **Mandatory Pre-Booking User Sync**: Before upserting to `bookings`, `/api/booking/create/route.ts` executes:
   ```typescript
   await admin
     .from('users')
     .upsert({
       user_id: user.id,
       email: user.email,
       team_id: team_id,
       role: 'captain',
     }, { onConflict: 'user_id' })
   ```
   This guarantees `public.users.team_id` is 100% populated in PostgreSQL before any booking insert occurs.

---

## 💳 Payment Modes: Test Direct Mode vs. Live Razorpay

### Current Development Mode: Direct Instant Booking (Testing Mode)
- `app/api/booking/create/route.ts` currently has `const isTestMode = true` enabled.
- Clicking "Register" bypasses the Razorpay checkout window, auto-confirms the booking (`is_test_booking = true`), updates `teams_booked_count`, and renders the booked card immediately.

### How to Re-enable Live Razorpay Payments:
1. Open `app/api/booking/create/route.ts`.
2. Locate line 157:
   ```typescript
   const isTestMode = true
   ```
3. Change it back to:
   ```typescript
   const isTestMode = Boolean(isTestAccount)
   ```
4. Save and deploy. This re-enables live Razorpay checkout modals for standard users while retaining instant testing mode for accounts flagged with `is_test_account = true`.

---

## 🛠️ Maintenance & Database Reset Scripts

The codebase includes utility scripts in `/scripts` to maintain, reconcile, or reset database state:

### 1. `scripts/clear-booking-data.js`
- **Purpose**: Wipes all booking and coupon records for a clean slate.
- **Action**:
  - `DELETE FROM bookings`
  - `DELETE FROM coupons`
  - `UPDATE slots SET teams_booked_count = 0, status = 'open'`
- **Execution**: `node scripts/clear-booking-data.js`

### 2. `scripts/verify-prior-accounts.js`
- **Purpose**: Reconciles legacy user accounts and links missing `team_id` or `captain_user_id` values in Supabase.
- **Execution**: `node scripts/verify-prior-accounts.js`

### 3. `scripts/fix-bookings-rls.js`
- **Purpose**: Bulk-syncs `public.users.team_id` across all existing Supabase user profiles.
- **Execution**: `node scripts/fix-bookings-rls.js`

---

## 🗂️ File Map & Component Directory

```
BGFS/
├── .env.local                       # Environment variables (Supabase & Razorpay keys)
├── next.config.ts                   # Next.js configuration
├── package.json                     # Node dependencies (Next 16, Supabase, Lucide React, Razorpay)
├── BuildSummary.md                  # Comprehensive project build summary & architecture guide (This file)
│
├── styles/
├── public/images/                   # High-res branding assets (faceofflogo.png, bgmilogo.png)
│
├── scripts/                         # Database maintenance scripts
│   ├── clear-booking-data.js        # Data wipe & slot capacity reset script
│   ├── verify-prior-accounts.js     # Legacy account & team reconciliation script
│   └── fix-bookings-rls.js          # Users table team_id sync script
│
├── lib/
│   ├── scoring.ts                   # BGIS 10-pt placement + elimination points & Best 5 Slots calculator
│   └── utils/
│       └── slotTime.ts              # Slot expiration helper & time comparison logic
│   └── supabase/
│       ├── client.ts                # Browser-side Supabase client initialization
│       ├── server.ts                # Server-side Supabase client (createClient & createAdminClient)
│       └── middleware.ts            # Auth session refresh middleware
│
└── app/
    ├── layout.tsx                   # Root HTML layout with Viewport & SEO metadata
    ├── page.tsx                     # Landing page
    ├── login/                       # Sign In (Password & OTP)
    ├── register/                    # Team & Account Registration
    ├── slots/                       # Slot Booking & Tournament Schedule
    │   ├── page.tsx                 # Auto-seeds 9-11 PM next 7 days & expires past slots
    │   ├── SlotsClient.tsx          # Date-grouped slots, instant booking UI, session & network error handling
    │   └── page.module.css
    ├── leaderboard/                 # Public Standings & Best 5 Slots (15 Matches) Leaderboard
    ├── dashboard/                   # Player Dashboard (My Slots with Room Slot #, My Standings, Password Change)
    ├── admin/                       # Super Admin Panel (Score entry helpers, role manager, test mode toggle)
    │
    └── api/                         # Backend API Routes
        ├── booking/
        │   ├── create/route.ts      # Slot booking API with test mode auto-confirm, team sync & Room Slot calc
        │   └── confirm/route.ts     # Slot booking confirmation API
        ├── coupon/
        │   └── redeem/route.ts      # Free slot coupon redemption API
        ├── register-team/route.ts   # Server-side Admin Client team creation API
        ├── setup-team/route.ts      # Server-side Admin Client squad onboarding API
        ├── team/
        │   └── rename/route.ts      # 1-time team rename API
        └── payment/
            ├── create-order/route.ts # Razorpay Order generation API
            ├── verify/route.ts       # Razorpay HMAC SHA-256 signature verification
            └── webhook/route.ts      # Razorpay async webhook listener
```

---

## ⚡ Current System Status Checklist

| Component | Status | Details |
| :--- | :---: | :--- |
| Next.js App Structure | ✅ COMPLETE | Next.js 16 (App Router), Turbopack clean build |
| Slot Booking Logic | ✅ COMPLETE | 20/20 capacity deduction, duplicate booking guard |
| Service Role RLS Fix | ✅ COMPLETE | All `/api` writes use `createAdminClient()` to bypass RLS violations |
| Room Slot Assignment | ✅ COMPLETE | FCFS starting at Slot 5; rendered on ticket, leaderboard & admin panel |
| Account Synchronization | ✅ COMPLETE | Legacy & new accounts synced with linked teams and `allUserTeamIds` queries |
| Session & Error Handling | ✅ COMPLETE | 401 session expiration redirects & graceful network error messages |
| Data Wipe Utility | ✅ COMPLETE | `scripts/clear-booking-data.js` ready for fresh tournament resets |
| Leaderboard Scoring | ✅ COMPLETE | Best 5 Slots (15 matches aggregate total points) calculator |
| Razorpay Gateway | ✅ VERIFIED | Verified signature check (Direct testing mode active in line 157 of `route.ts`) |
| Production Build | ✅ PASSED | `npm run build` compiles with 0 errors |

---

## 📋 Quick Setup Checklist for Live Deployment:
1. Execute `supabase/migrations/001_initial_schema.sql`, `002_slot_booking_v2.sql`, `003_best_5_slots_leaderboard.sql`, `004_admin_test_mode.sql`, and `004_room_slot_number.sql` in your Supabase SQL Editor.
2. In Vercel Project Settings > **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
3. In Supabase > Authentication > **URL Configuration**, add your domain (`https://battlegroundsfaceoffseries.com`) to **Redirect URLs**.

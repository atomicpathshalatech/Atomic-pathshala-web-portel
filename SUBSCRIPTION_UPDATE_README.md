# Atomic Pathshala — Update Package (Subscription System)

This zip contains **only new/changed files** — copy them into your existing
`atomic-ops` project, overwriting where prompted. Do NOT extract this over
`node_modules` or delete anything else in your project.

## What's new in this update

App-wide, 2-tier subscription access (**BASIC** / **PRO**) — replaces the
idea of batch-locked access. Both plans get every course, batch, crash
course, test series (PYQ/Educator/Batch), doubt solving, full-syllabus
notes, practice modules, and the 15K+ QBank. PRO additionally unlocks:

- 1:1 Mentorship
- NEET UG Assure*
- Dedicated Batch WhatsApp Community
- SRG NCERT Weekly + Revision Test Series

**7-day free trial** on first signup (change `FREE_TRIAL_DAYS` in
`src/lib/subscription/config.ts` — nowhere else needs to change).

**Billing:** both recurring and fixed-duration are supported —

- `MONTHLY` → Razorpay **Subscriptions** (auto-renews; confirmed via the
  `subscription.charged` webhook, not the client)
- `QUARTERLY` / `HALF_YEARLY` / `ANNUAL` → Razorpay **Orders** (one-time
  payment for that fixed period; confirmed by `/api/subscriptions/verify`
  right after the Razorpay Checkout success callback)

**Upgrade/downgrade:** `POST /api/subscriptions/change-plan` stages the new
plan in `pendingPlan` — it's only applied at the START of the next billing
cycle (no proration), per your call. For a MONTHLY subscriber this happens
automatically in the `subscription.charged` webhook handler.

**Pricing is admin-editable**, not hardcoded — BASIC is ₹2,400/yr and PRO is
₹3,600/yr (the numbers you gave), with Monthly/Quarterly/Half-yearly derived
proportionally as seed defaults. Anyone with the `SUBSCRIPTION_MANAGE`
permission can change any of the 8 (plan × cycle) prices any time at
`/team/subscriptions/pricing` — takes effect on the next checkout/renewal,
already-active subscriptions keep their current period's price.

## New files

```
src/lib/subscription/config.ts        — plans, gated features, pricing, trial length (single source of truth)
src/lib/subscription/guard.ts         — hasFeatureAccess() / requireFeature() / requireActiveSubscription()
src/lib/payments/razorpay.ts          — Razorpay client + signature verification helpers
src/lib/validation/subscription.ts    — Zod schemas for the API routes below
src/server/services/subscription-service.ts — all business logic (trial, checkout, verify, webhook, plan change, cancel)
src/app/api/subscriptions/route.ts               — GET current plan + status + unlocked features
src/app/api/subscriptions/trial/route.ts         — POST start trial checkout (Razorpay Subscription, delayed first charge)
src/app/api/subscriptions/trial/confirm/route.ts — POST confirm card verification, creates the trial Subscription row
src/app/api/subscriptions/checkout/route.ts      — POST create Razorpay order/subscription
src/app/api/subscriptions/verify/route.ts        — POST confirm a fixed-duration order payment
src/app/api/subscriptions/change-plan/route.ts   — POST stage a plan change for next cycle
src/app/api/subscriptions/cancel/route.ts        — POST cancel at period end
src/app/api/webhooks/razorpay/route.ts           — Razorpay webhook receiver (raw-body signature verified)
src/app/(student)/subscription/page.tsx          — student-facing pricing/billing page
src/components/student/SubscriptionManager.tsx   — client component: trial, checkout (Razorpay widget), switch plan, cancel
src/app/(team)/team/subscriptions/page.tsx                  — admin: list + status stats + search
src/app/(team)/team/subscriptions/[studentId]/page.tsx      — admin: one student's plan + payment history + manage panel
src/components/team-portal/SubscriptionAdminPanel.tsx       — client component: manual grant/extend/revoke (offline payments)
src/app/api/team/subscriptions/[studentId]/grant/route.ts   — POST manually grant/extend a plan
src/app/api/team/subscriptions/[studentId]/revoke/route.ts  — POST immediately revoke access
src/lib/validation/team-subscription.ts                     — Zod schema for the grant endpoint
src/lib/subscription/pricing.ts                    — DB-backed pricing (seed defaults + getPlanPrice/getAllPlanPricing/updatePlanPricing)
src/app/(team)/team/subscriptions/pricing/page.tsx  — admin: editable pricing grid
src/components/team-portal/PlanPricingEditor.tsx    — client component for the pricing grid
src/app/api/team/subscriptions/pricing/route.ts     — PATCH update prices (SUBSCRIPTION_MANAGE only)
```

## Changed files

- `prisma/schema.prisma` — adds `Subscription`, `SubscriptionPayment` models
  + `SubscriptionPlan` / `BillingCycle` / `SubscriptionStatus` / `PaymentStatus`
  enums, and a `subscription` relation on `Student`.
- `.env.example` — adds `RAZORPAY_WEBHOOK_SECRET` and
  `NEXT_PUBLIC_RAZORPAY_KEY_ID` (the client-side Checkout widget needs the
  public key id).
- `package.json` — adds the `razorpay` SDK dependency.
- `src/lib/api/response.ts` — `handleApiError` now also translates
  `SubscriptionError` (from the service layer) into a 409 response.
- `middleware.ts` — `/subscription` added to the protected student paths.
- `src/app/(student)/layout.tsx` — "Subscription" nav link added.
- `src/lib/rbac/permissions.ts` — adds `SUBSCRIPTION_MANAGE` permission,
  granted to the FINANCE role by default (SUPER_ADMIN/FOUNDER already get
  every permission).
- `src/app/(team)/team/layout.tsx` — "Subscriptions" nav link added
  (visible to anyone with `FINANCE_READ`).

## Admin (Finance/Team) side — for offline/cash payments

Not every payment goes through Razorpay — a lot of coaching-institute
payments are cash/UPI in person. `/team/subscriptions` (any role with
`FINANCE_READ`, e.g. Finance, Super Admin, Founder) lists every student's
plan/status with search, and `/team/subscriptions/[studentId]` shows full
payment history plus — for roles with the new `SUBSCRIPTION_MANAGE`
permission (Finance by default) — a form to manually grant/extend a plan
(records it as an `OFFLINE` payment) or immediately revoke access. Every
manual action is written to `AuditLog` (`SUBSCRIPTION_GRANTED_MANUALLY` /
`SUBSCRIPTION_REVOKED_MANUALLY`) with who did it.

## How to apply

```bash
# 1. Copy the files from this zip into your project root, overwriting
#    prisma/schema.prisma, prisma/seed.ts, .env.example, package.json, and
#    src/lib/api/response.ts, and adding all the new files.

# 2. Install the new dependency
npm install

# 3. Fill in the new env vars in your real .env
#    RAZORPAY_WEBHOOK_SECRET       — set this in the Razorpay dashboard
#                                    webhook config too, same value
#    NEXT_PUBLIC_RAZORPAY_KEY_ID   — same value as RAZORPAY_KEY_ID

# 4. Regenerate the Prisma client and run the migration
npx prisma generate
npx prisma migrate dev --name subscriptions

# 4b. Seed the default plan pricing (BASIC/PRO x 4 cycles)
npx prisma db seed

# 5. In the Razorpay dashboard, add a webhook pointing at
#    https://<your-domain>/api/webhooks/razorpay
#    Subscribe to at least: subscription.charged, subscription.cancelled,
#    payment.failed

# 6. Start the app
npm run dev
```

*(I wasn't able to run `prisma validate` / `npm install` here — no network
access in this environment — so please run steps 2 and 4 on your machine
and let me know if anything errors.)*

## How to gate a page/route with this

```ts
// any Server Action or API route that needs CORE paid access:
import { requireActiveSubscription } from "@/lib/subscription/guard";
await requireActiveSubscription(student.id);

// anything that needs a PRO-only feature:
import { requireFeature } from "@/lib/subscription/guard";
import { SUBSCRIPTION_FEATURE_KEYS } from "@/lib/subscription/config";
await requireFeature(student.id, SUBSCRIPTION_FEATURE_KEYS.MENTORSHIP_1_1);
```

Both throw `ForbiddenError`/`UnauthorizedError` (the same classes your RBAC
guard already uses), so `handleApiError` in API routes handles them for
free. Your Course/Test/QBank/Doubt modules aren't built yet (Phase 3 per
your main README) — wire these two calls in wherever those land.

## Notes / things to sanity-check on your machine

- Razorpay **Plan** objects (needed for recurring MONTHLY subscriptions)
  are created on first use and cached **in-memory only**
  (`src/server/services/subscription-service.ts` → `razorpayPlanIdCache`).
  That's fine for getting started, but on every server restart it'll
  create a fresh Plan on Razorpay's side. Before real traffic, persist the
  created `plan_id`s (e.g. a small config table or env vars) instead.
- `total_count: 120` on the Razorpay Subscription create call is Razorpay's
  required cap on how many cycles a subscription can run — ~10 years of
  monthly billing; bump it if you need longer.
- The free trial requires a card upfront — starting a trial opens the
  Razorpay Checkout widget on a Subscription with `start_at` set to 7 days
  out, so the card is authorized/tokenized immediately but nothing is
  charged until the trial ends, at which point Razorpay auto-charges and
  the existing `subscription.charged` webhook flips it to ACTIVE.
  The DB row is only created after Razorpay confirms the card was
  verified (`/api/subscriptions/trial/confirm`) — not before — so an
  abandoned checkout leaves no record and no free access.
- One `Subscription` row per student (not a history table) — plan changes
  update it in place; payment history lives in `SubscriptionPayment`.

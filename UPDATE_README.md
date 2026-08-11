# Atomic Pathshala — Update Package (Onboarding Suite)

This zip contains **only new/changed files** — copy them into your existing
`atomic-ops` project, overwriting where prompted. Do NOT extract this over
`node_modules` or delete anything else in your project.

## What's new in this update

1. **ID / KYC Document Management** — teachers upload documents at
   `/team/documents`; HR/Academic Head verify or reject at
   `/team/onboarding/[id]`.
2. **Faculty Onboarding Queue** — `/team/onboarding` lists every educator
   still moving through documents → contract → active, with a reject action
   at any stage.
3. **Digital Contract / e-Signature** — HR/Academic Head compose and send a
   contract once documents are verified; the teacher signs (typed legal
   name, timestamped, IP-logged) or declines at `/team/contracts/[id]`.
4. **Penalty & Compliance Rule Engine** — `/team/compliance` lets
   HR/Academic Head define rules (fixed ₹ or % deductions) and apply
   penalties against a teacher's monthly payout; teachers see their own
   record there too.
5. **Faculty Leaderboard** — `/team/leaderboard` ranks active educators by
   doubts resolved, manual rating, and this month's compliance record.

## How to apply

```powershell
# 1. From your project root, copy the files from this zip in, overwriting
#    prisma/schema.prisma and adding all the new src/ files.

# 2. Regenerate the Prisma client and run the migration
npx prisma generate
npx prisma migrate dev --name onboarding_documents_contracts_penalties

# 3. Re-seed (adds the new permission codes to existing roles — safe to
#    re-run, it's idempotent)
npm run db:seed

# 4. Start the app
npm run dev
```

## New onboarding flow (end-to-end)

```
PENDING_DOCUMENTS → upload docs → PENDING_REVIEW
  → HR/Academic Head verifies GOVT_ID_FRONT + PAN_CARD + PHOTO → PENDING_CONTRACT
  → HR/Academic Head sends contract → teacher signs → ACTIVE
```
At any stage, HR/Academic Head can reject the application (`REJECTED`),
which also suspends the linked user account.

## Notes / things to sanity-check on your machine

- Document files are stored as base64 data URLs directly in Postgres for
  now (no S3/object storage wired up yet) — fine for testing, but swap in
  real object storage before production with real file sizes.
- The leaderboard scoring formula (doubts resolved × 10 + rating × 20 −
  monthly penalties × 0.1) is a starting point — tune the weights in
  `src/app/api/team/leaderboard/route.ts` and
  `src/app/(team)/team/leaderboard/page.tsx` (kept in sync manually).
- HR and Academic Head both got the new permissions
  (`document.verify`, `onboarding.review`, `contract.create`,
  `penalty.rule.manage`, etc.) — check `src/lib/rbac/permissions.ts` if you
  want to split those up differently between the two roles.

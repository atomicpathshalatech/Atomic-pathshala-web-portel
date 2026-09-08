# Moving the database to Mumbai (`ap-south-1`)

## Why

Vercel functions run in `bom1` (Mumbai, pinned in `vercel.json`). The Supabase
Postgres project is currently in `ap-northeast-1` (Tokyo). Every authenticated
page does **4–5 sequential Prisma round trips** before it renders; each one
crosses Mumbai↔Tokyo (~120–140 ms RTT). That is the single largest source of
"click → wait → page".

Co-locating the database with the compute removes ~600 ms–1 s per navigation.
Everything else (connection pooler, `unstable_cache`, Prisma Accelerate) is a
complement, not a substitute, for this.

## Scope

**Only Postgres moves.** Confirmed from the codebase:

- Object storage is **Cloudflare R2** (`STORAGE_PROVIDER=cloudflare-r2`), not
  Supabase Storage — nothing to migrate there.
- Auth is **NextAuth (JWT strategy, Credentials provider)** — no Supabase Auth,
  no `@auth/prisma-adapter` tables in use beyond the app's own schema.
- There is **no `@supabase/supabase-js`** usage anywhere in `src` — the
  `NEXT_PUBLIC_SUPABASE_*` / `SUPABASE_SERVICE_ROLE_KEY` env vars are currently
  unused. Update them for hygiene but nothing depends on them.

So: dump the `public` schema from the old project, restore it into a new
`ap-south-1` project, swap two env vars, redeploy.

## Prerequisites

- `pg_dump` / `pg_restore` / `psql` **v15+** locally (`psql --version`).
  Windows: install "PostgreSQL" (or just the "Command Line Tools" component)
  from the EDB installer, or `winget install PostgreSQL.PostgreSQL`.
- The old project's **direct** connection string (port 5432) and DB password.
- A short maintenance window (dump + restore of this schema is typically a few
  minutes; size it from `SELECT pg_size_pretty(pg_database_size('postgres'));`).

## Step 1 — Create the new project

Supabase dashboard → **New project**:

- Organization: same as now
- Region: **South Asia (Mumbai)** → `ap-south-1`
- Database password: generate a strong one, save it
- Plan: match the current project (Pro if the current one is Pro, so the
  compute size and connection limits match)

Note the new **project ref** (the `abcdefghijklmnop` in `db.<ref>.supabase.co`).

## Step 2 — Freeze writes (maintenance window)

Pick a low-traffic time. Options, least to most disruptive:

- **Best:** put the app in maintenance mode (e.g. a Vercel env flag your
  middleware checks) so no writes land mid-dump.
- **Acceptable:** accept that writes in the dump→cutover gap (a few minutes)
  are lost. For this app that means a handful of quiz attempts / chat messages
  at most if you pick the right hour.

## Step 3 — Dump the old database

```bash
# Old project — DIRECT connection (5432), NOT the pooler.
OLD="postgresql://postgres:[OLD-PASSWORD]@db.[OLD-REF].supabase.co:5432/postgres"

pg_dump "$OLD" \
  --format=custom \
  --no-owner --no-privileges \
  --schema=public \
  --file=atomic_$(date +%Y%m%d_%H%M).dump
```

- `--schema=public` skips Supabase-managed schemas (`auth`, `storage`,
  `realtime`, `extensions`, …) which the new project already provisions.
- `--no-owner --no-privileges` avoids "role does not exist" noise on restore.
- `--format=custom` lets `pg_restore` run with `--clean` and parallel jobs.

## Step 4 — Restore into the new database

```bash
# New project — DIRECT connection (5432).
NEW="postgresql://postgres:[NEW-PASSWORD]@db.[NEW-REF].supabase.co:5432/postgres"

pg_restore \
  --dbname="$NEW" \
  --no-owner --no-privileges \
  --clean --if-exists \
  --jobs=4 \
  atomic_YYYYMMDD_HHMM.dump
```

Ignore errors of the form `extension "x" already exists` / `schema "public"
already exists` — those objects are pre-created by Supabase and `--if-exists`
makes the DROP a no-op.

## Step 5 — Verify parity

```bash
# Prisma sees a clean, fully-migrated schema:
DIRECT_URL="$NEW" npx prisma migrate status

# Row counts match between old and new for the tables that matter:
npx tsx scripts/verify-db-parity.ts "$OLD" "$NEW"
```

`scripts/verify-db-parity.ts` (in this PR) counts a fixed set of core tables
against both URLs and prints a diff. Zero diffs = restore is good.

## Step 6 — Cut over

In **Vercel → Project → Settings → Environment Variables** (Production, and
Preview if it points at the same DB), replace:

```
DATABASE_URL = postgresql://postgres.[NEW-REF]:[NEW-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL   = postgresql://postgres.[NEW-REF]:[NEW-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
```

- Port **6543** = transaction pooler (runtime). Port **5432** = direct (migrations).
- Get the exact pooler host from: new project → Settings → Database →
  **Connection pooling** → "Transaction" → URI.
- Also update `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
  `SUPABASE_SERVICE_ROLE_KEY` to the new project (unused today, but keep sane).

Then **Redeploy** the production deployment (envs only apply on a new build).

`vercel.json` already pins `regions: ["bom1"]` — **leave it as-is**. Mumbai
compute + Mumbai DB is the target.

## Step 7 — Smoke test on production

- Login (student → `/dashboard`, teacher → `/team`)
- `/courses` loads, a batch create in Team shows up on `/courses`
- Open a test, submit an attempt, view result
- Start/join a live class
- Notifications bell count is correct
- Check Vercel function logs for `P1001` / `Can't reach database` — none expected

## Step 8 — Keep the old project ~7 days

Pause it (don't delete) as an instant rollback: revert the two Vercel env vars
and redeploy. After a week of clean production, delete it.

## After the move

Expected: `compute → DB` drops from ~130 ms × (4–5 queries) to ~2–5 ms each.
Combined with the `unstable_cache` layer added in the perf PR, most navigations
should feel instant. If read volume later outgrows a single region, add
**Prisma Accelerate** on top (query cache + global pooling) — not before.

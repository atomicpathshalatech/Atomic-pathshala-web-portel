# Atomic Question Bank — Baseline Audit (Phase A)

_Generated 2026-10-29. All counts are from read-only queries against the live app database; nothing was written or migrated._

## TL;DR

Most of the requested architecture **already exists** in this codebase. The real problems are (1) a **two-database split-brain** in `.env`, (2) **question creation fragmented across 11 independent insert sites** so dedup/fingerprinting is applied inconsistently, and (3) overlapping verification/QC subsystems (one of which is unmigrated dead schema). This workstream centralizes creation + duplicate prevention; other phases are tracked separately.

## 🔴 Critical infrastructure finding — split database configuration

`.env` points Prisma at **two different Supabase projects**:

| Var | Project ref | Used by | Live `questions` rows |
|---|---|---|---|
| `DATABASE_URL` (pooler) | `nsubtmwavgzfyxuhlmjx` | the running app (`url`) | **4,839** (modern schema) |
| `DIRECT_URL` | `itronpjlguvyrfwzxijh` | Prisma migrations / introspection (`directUrl`) | 15 (stale, old schema) |

Prisma runs `migrate dev` / `migrate deploy` / shadow-DB / introspection against `directUrl`. So **migrations target `itronpj` while the app reads/writes `nsubtm`.** Consequences already visible: the app DB's schema was advanced out-of-band (likely `prisma db push`), the migration folder does not match either DB, and any future `prisma migrate deploy` will hit the wrong (stale) project. This is the most likely root cause behind "questions disappear", "migrations don't take effect", and schema-mismatch errors. **It must be resolved before any schema migration is run.**

## Live inventory (app DB — `nsubtm`)

- **Total questions: 4,839** — DRAFT 4,174 · PUBLISHED 629 · REVIEW_1 36. `isPublished=true`: 629.
- **Subjects:** Chemistry 2,418 · Biology 2,017 · Physics 393 · Botany 10 · Mathematics 1. **examLevel:** all NEET.
- **Canonical IDs:** `questionCode` set on all 4,839, **zero duplicates** — the ID system is sound.
- **`contentFingerprint`: populated on only 30 of 4,839 rows (0.6%)** — duplicate fingerprinting is effectively not applied at creation. This is the core gap.
- **AI audit:** PENDING 4,637 · VERIFIED 108 · FAILED 66 · MODIFIED 25 · NEEDS_HUMAN_REVIEW 3. **aiVerified=true:** 129.
- **QC:** UNREVIEWED 4,824 · VERIFIED 13 · ERROR 1 · NEEDS_HUMAN_REVIEW 1 — QC has barely run.
- **Images:** only 295 of 4,839 questions have an `imageUrl` (4,544 missing).
- **Translations:** every question has ≥1; HINDI 3,171 · ENGLISH 2,726 · **`english` (lowercase) 19 — a casing-normalization bug.** Bilingual (≥2 languages): 1,077.
- **Other sources:** extracted_questions 2,150 · ai_generated_questions 478 · pyq_occurrences 30 · question_duplicate_candidates 300 · qc_reviews 32.
- **Extraction jobs (43):** IMPORTED_TO_DRAFT 19 · VERIFIED 15 · PROCESSING 5 (stuck?) · REVIEW_REQUIRED 2 · FAILED 2.
- **`question_assignments`: 0 rows** — "My Question Bank" self-assignment has never been used (matches the reported bug).
- **Relationship integrity to preserve:** 626 `section_questions` links (tests) + 30 `dpp_questions` links = **656 questions referenced downstream**; `exercise_questions` 0. Any consolidation must keep these `questionId`s stable (and `questionCode` is already stable, so this is safe).

## The 11 question-creation sites

| Site | Sets fingerprint? | Concurrency-safe code? |
|---|---|---|
| `api/team/questions/route.ts` (manual) | ❌ | ✅ `withNewQuestionCode` |
| `api/team/questions/engine/route.ts` | ✅ | ✅ |
| `api/team/questions/auto-draft/route.ts` | ❌ | ✅ |
| `api/team/questions/bilingual/route.ts` | ❌ | ✅ |
| `api/team/ai-questions/save-to-draft/route.ts` | ❌ | ✅ |
| `api/questions/[id]/report/route.ts` (placeholder) | ❌ | ❌ |
| `lib/ai-question-engine/job-runner.ts` | ❌ | partial |
| `lib/ai-chat/atomicGuruPipeline.ts` | ❌ | ❌ (pre-generated code) |
| `lib/ncert/question-pool.ts` | ❌ | ❌ (pre-generated code) |
| `lib/extraction/draft-importer.ts` | ✅ | ✅ (reference impl) |
| `lib/pyq/review-service.ts` | ✅ | ✅ |

Only 3/11 compute `contentFingerprint`; the pre-generated-code paths are those documented in `create-with-code.ts` as the cause of "duplicate code → silent question loss".

## What already exists and is reused (do **not** rebuild)

- `lib/pyq/fingerprint.ts` — metadata-independent SHA-1 statement+options fingerprint, plus `compareQuestions()` with calibrated scoring that caps similarity when the numbers in the statement differ. Matches the brief's safety rules.
- `lib/questions/content-hash.ts` — SHA-256 content+metadata hash used for re-audit triggering.
- `lib/questions/create-with-code.ts` — `withNewQuestionCode()` claim-and-retry-on-P2002 code assignment.
- `lib/questions/id-generator.ts` — canonical 10-char `questionCode` generator.
- `QuestionDuplicateCandidate` table (300 rows) — reversible duplicate review, never auto-deletes.

## This workstream: centralize creation + dedup

**New module `lib/questions/question-management-service.ts`** generalizes the `draft-importer` pattern: normalize → fingerprint → exact-duplicate idempotency check → concurrency-safe code claim → create (with translations) → audit. All 11 sites route through it. New questions get a fingerprint going forward, closing the 0.6% gap at the source.

### Decisions needed before touching production data
1. **`DIRECT_URL` split-brain** — point it at the real app project, or confirm the intended topology, before any migration.
2. **Write authorization** — I currently have read-only access. Backfilling `contentFingerprint` on ~4,809 existing rows, and an end-to-end create smoke test, need write access. The code ships and typechecks regardless; backfill is a separate, reversible step.
3. **DB-level unique index on `contentFingerprint`** (full concurrency-safe exact-dedup) requires a migration — deferred until (1) is fixed. Until then, dedup is application-level (handles the common double-submit/retry case).

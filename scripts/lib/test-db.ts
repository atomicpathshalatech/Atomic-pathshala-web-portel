/**
 * Shared safety guard + setup for the live-class DB integration tests.
 *
 * Allowed targets only:
 *   - a localhost database whose name contains "test", or
 *   - a separate throwaway remote project with ALLOW_REMOTE_TEST_DB="yes",
 *     which is never the production project (known project ref, and every
 *     DATABASE_URL/DIRECT_URL in .env, .env.local, .env.production).
 * The target database is WIPED by prepareTestDatabase().
 */
import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const KNOWN_PRODUCTION_PROJECT_REFS = ["nsubtmwavgzfyxuhlmjx"];

function identity(u: URL): string {
  return `${u.hostname}|${decodeURIComponent(u.username)}`;
}

function productionIdentities(): string[] {
  const ids: string[] = [];
  for (const file of [".env", ".env.local", ".env.production"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*(DATABASE_URL|DIRECT_URL)\s*=\s*"?([^"\s]+)"?/);
      if (!m) continue;
      try {
        ids.push(identity(new URL(m[2]!)));
      } catch {
        // not a URL — ignore
      }
    }
  }
  return ids;
}

/** Validates TEST_DATABASE_URL and points DATABASE_URL/DIRECT_URL at it. Exits the process if it is not a safe test target. */
export function requireTestDatabase(): { testUrl: string; parsed: URL } {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    console.error("TEST_DATABASE_URL is not set.");
    process.exit(2);
  }
  const parsed = new URL(testUrl);
  const isLocalTestDb = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname) && /test/i.test(parsed.pathname);
  const isOptedInRemoteTestDb =
    process.env.ALLOW_REMOTE_TEST_DB === "yes" &&
    !KNOWN_PRODUCTION_PROJECT_REFS.some((ref) => testUrl.includes(ref)) &&
    !productionIdentities().includes(identity(parsed));
  if (!isLocalTestDb && !isOptedInRemoteTestDb) {
    console.error(
      `Refusing: TEST_DATABASE_URL must be a localhost database whose name contains "test", ` +
        `or a separate throwaway project with ALLOW_REMOTE_TEST_DB="yes" (never the production project). Got ${parsed.hostname}${parsed.pathname}.`
    );
    process.exit(2);
  }
  process.env.DATABASE_URL = testUrl;
  process.env.DIRECT_URL = testUrl;
  return { testUrl, parsed };
}

/**
 * Wipes and rebuilds the test database.
 *   TEST_DB_SETUP=base-plus-migration (recommended): the pre-redesign schema
 *     from TEST_DB_BASE_REF (default: the commit before the redesign migration) via db push, then only the
 *     redesign migration on top — what `prisma migrate deploy` does in prod.
 *     (The full migration history does not replay on an empty DB: migration
 *     20260911150000 alters a "NotificationType" enum no migration creates.)
 *   otherwise: prisma migrate reset (full history).
 */
export function prepareTestDatabase(testUrl: string, parsed: URL) {
  const env = { ...process.env, DATABASE_URL: testUrl, DIRECT_URL: testUrl };
  if (process.env.TEST_DB_SETUP === "base-plus-migration") {
    const dir = mkdtempSync(join(tmpdir(), "live-session-test-"));
    const baseSchema = join(dir, "schema.prisma");
    // Default base: the commit just before the redesign migration was added
    // (main already contains it once merged, so "origin/main" can't be the base).
    const baseRef =
      process.env.TEST_DB_BASE_REF ||
      execSync(
        "git log --diff-filter=A --format=%H -1 -- prisma/migrations/20260927120000_live_session_youtube_delivery/migration.sql",
        { encoding: "utf8" }
      ).trim() + "~1"; // "~1", not "^": cmd.exe treats ^ as an escape character
    writeFileSync(baseSchema, execSync(`git show ${baseRef}:prisma/schema.prisma`, { encoding: "utf8" }));
    console.log(`Rebuilding ${parsed.pathname.slice(1)} from ${baseRef}'s schema, then applying the redesign migration…`);
    execSync(`npx prisma db push --force-reset --skip-generate --accept-data-loss --schema "${baseSchema}"`, { stdio: "inherit", env });
    // The redesign migration and every migration after it, in order — what
    // `prisma migrate deploy` applies in prod.
    const later = readdirSync("prisma/migrations")
      .filter((m) => /^\d{14}_/.test(m) && m >= "20260927120000")
      .sort();
    for (const m of later) {
      execSync(`npx prisma db execute --url "${testUrl}" --file prisma/migrations/${m}/migration.sql`, { stdio: "inherit", env });
    }
  } else {
    console.log(`Resetting ${parsed.pathname.slice(1)} on ${parsed.hostname} and applying all migrations…`);
    execSync("npx prisma migrate reset --force --skip-seed --skip-generate", { stdio: "inherit", env });
  }
}

export function createAsserts() {
  let passCount = 0;
  let failCount = 0;
  return {
    assert(condition: boolean, testName: string, detail?: string) {
      if (condition) {
        console.log(`✅ PASS: ${testName}`);
        passCount++;
      } else {
        console.error(`❌ FAIL: ${testName}${detail ? ` - ${detail}` : ""}`);
        failCount++;
      }
    },
    async rejects(p: Promise<unknown>, match?: RegExp): Promise<boolean> {
      try {
        await p;
        return false;
      } catch (err) {
        return match ? match.test(err instanceof Error ? err.message : String(err)) : true;
      }
    },
    finish() {
      console.log(`\n${passCount} passed, ${failCount} failed`);
      if (failCount > 0) process.exit(1);
    },
  };
}

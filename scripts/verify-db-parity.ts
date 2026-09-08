/**
 * Row-count parity check between two Postgres databases — used during the
 * Tokyo -> Mumbai migration (see docs/DB_MUMBAI_MIGRATION.md).
 *
 *   npx tsx scripts/verify-db-parity.ts "<OLD_DIRECT_URL>" "<NEW_DIRECT_URL>"
 *
 * Prints a table of counts for a fixed set of core tables and exits non-zero
 * if any differ. Uses `pg` directly (not Prisma) so it can point at any two
 * connection strings without a schema/client tied to one of them.
 */
import { Client } from "pg";

// Core tables whose row counts must match exactly after restore. Add more if
// you want a stricter check; these cover users, RBAC, academics, assessments,
// attempts, payments, notifications and audit.
const TABLES = [
  "users",
  "roles",
  "permissions",
  "role_permissions",
  "students",
  "teachers",
  "courses",
  "batches",
  "batch_enrollments",
  "batch_schedules",
  "chapters",
  "lectures",
  "questions",
  "tests",
  "dpps",
  "attempts",
  "attempt_answers",
  "subscriptions",
  "SubscriptionPayment",
  "notifications",
  "device_sessions",
  "audit_logs",
];

async function counts(url: string): Promise<Record<string, number | string>> {
  const client = new Client({ connectionString: url });
  await client.connect();
  const out: Record<string, number | string> = {};
  for (const t of TABLES) {
    try {
      const r = await client.query<{ c: string }>(`SELECT count(*)::text AS c FROM "${t}"`);
      out[t] = Number(r.rows[0]?.c ?? -1);
    } catch (e) {
      out[t] = `ERR: ${(e as Error).message.split("\n")[0]}`;
    }
  }
  await client.end();
  return out;
}

async function main() {
  const [oldUrl, newUrl] = process.argv.slice(2);
  if (!oldUrl || !newUrl) {
    console.error('Usage: tsx scripts/verify-db-parity.ts "<OLD_URL>" "<NEW_URL>"');
    process.exit(2);
  }

  const [a, b] = await Promise.all([counts(oldUrl), counts(newUrl)]);

  let mismatches = 0;
  console.log("\n  table".padEnd(26) + "old".padStart(12) + "new".padStart(12) + "   status");
  console.log("  " + "-".repeat(58));
  for (const t of TABLES) {
    const ov = a[t];
    const nv = b[t];
    const ok = ov === nv && typeof ov === "number";
    if (!ok) mismatches++;
    console.log(
      "  " +
        t.padEnd(24) +
        String(ov).padStart(12) +
        String(nv).padStart(12) +
        (ok ? "   ok" : "   <<< MISMATCH")
    );
  }
  console.log("  " + "-".repeat(58));

  if (mismatches === 0) {
    console.log(`\n  ✅ all ${TABLES.length} tables match\n`);
    process.exit(0);
  }
  console.log(`\n  ❌ ${mismatches} table(s) differ — do not cut over\n`);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Roles & permissions API against a LOCAL test database: any permission in the
 * catalogue can be granted (no seed run needed), unknown codes are refused,
 * and a role's permissions are replaced in one step.
 *
 * Run (localhost database whose name contains "test"; needs the local
 * qc-admin@example.test admin user):
 *   TEST_DATABASE_URL="postgresql://postgres@localhost:5433/qc_test" \
 *     npx tsx --tsconfig tsconfig.json scripts/test-roles-api-db.ts
 */
import "./qc/_stub";

const testUrl = process.env.TEST_DATABASE_URL ?? "";
const u = new URL(testUrl || "postgresql://x/none");
if (!["localhost", "127.0.0.1"].includes(u.hostname) || !/test/i.test(u.pathname)) {
  console.error('Refusing: TEST_DATABASE_URL must be a localhost database whose name contains "test".');
  process.exit(2);
}
process.env.DATABASE_URL = testUrl;
process.env.DIRECT_URL = testUrl;

let sessionUserId = "";
// eslint-disable-next-line @typescript-eslint/no-var-requires
require("next-auth/next").getServerSession = async () => ({ user: { id: sessionUserId } });

let passed = 0;
let failed = 0;
const assert = (c: unknown, l: string) => {
  if (c) passed++;
  else failed++;
  console.log(`  ${c ? "ok  " : "FAIL"} ${l}`);
};

async function run() {
  const { prisma } = await import("../src/lib/db");
  const { NextRequest } = await import("next/server");
  const { PERMISSIONS } = await import("../src/lib/rbac/permissions");
  const roles = await import("../src/app/api/team/roles/route");
  const admin = await prisma.user.findFirst({ where: { email: "qc-admin@example.test" } });
  if (!admin) throw new Error("qc-admin@example.test is missing from the test database");
  sessionUserId = admin.id;
  const post = async (body: unknown) => {
    const res = await roles.POST(new NextRequest("https://example.test/api/team/roles", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));
    return { status: res.status, json: (await res.json().catch(() => null)) as any };
  };
  // An existing role of the local test database; its permissions are put back afterwards.
  const roleName = "DESIGNER";
  const role = await prisma.role.upsert({ where: { name: roleName }, update: {}, create: { name: roleName, label: "Designer", isSystem: true } });
  const before = await prisma.rolePermission.findMany({ where: { roleId: role.id }, select: { permissionId: true } });

  try {
    const list = await (await roles.GET()).json();
    assert(list.allPermissions?.length === new Set(Object.values(PERMISSIONS)).size, `GET lists every catalogue permission (${list.allPermissions?.length})`);

    const custom = await post({ action: "CREATE_ROLE", roleName: "ZZ_NOT_A_ROLE", label: "x", permissions: [] });
    assert(custom.status === 400 && /must be one of/.test(custom.json?.error ?? ""), `A role name outside the fixed list gets a clear message, not a server error (${custom.status})`);
    const set2 = await post({ action: "UPDATE_PERMISSIONS", roleName, permissions: [PERMISSIONS.LIVE_CLASS_ADMIN, PERMISSIONS.BATCH_SCHEDULE_MANAGE] });
    assert(set2.status === 200, `Live-class permissions can be granted (${set2.status})`);
    const codes = async () =>
      (await prisma.rolePermission.findMany({ where: { role: { name: roleName } }, select: { permission: { select: { code: true } } } })).map((r) => r.permission.code).sort();
    assert(JSON.stringify(await codes()) === JSON.stringify([PERMISSIONS.BATCH_SCHEDULE_MANAGE, PERMISSIONS.LIVE_CLASS_ADMIN].sort()), "It holds exactly those two");

    const bad = await post({ action: "UPDATE_PERMISSIONS", roleName, permissions: [PERMISSIONS.CHAPTER_READ, "made.up.permission"] });
    assert(bad.status === 400, `An unknown permission is refused (${bad.status})`);
    assert((await codes()).length === 2, "…and the role is left as it was");

    const upd = await post({ action: "UPDATE_PERMISSIONS", roleName, permissions: [PERMISSIONS.CHAPTER_READ, PERMISSIONS.WHITEBOARD_ACCESS, PERMISSIONS.CHAPTER_READ] });
    assert(upd.status === 200 && JSON.stringify(await codes()) === JSON.stringify([PERMISSIONS.CHAPTER_READ, PERMISSIONS.WHITEBOARD_ACCESS].sort()), "Updating replaces the set (duplicates ignored)");
  } finally {
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (before.length) await prisma.rolePermission.createMany({ data: before.map((b) => ({ roleId: role.id, permissionId: b.permissionId })) });
    await prisma.$disconnect();
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
run().catch((err) => {
  console.error(err);
  process.exit(1);
});

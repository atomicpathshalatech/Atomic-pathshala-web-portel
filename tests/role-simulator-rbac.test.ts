import { prisma } from "../src/lib/db";
import {
  simulateEmployee,
  simulateRole,
  compareSimulations,
} from "../src/lib/rbac/role-simulator";
import { isSuperAdminUser, hasPermission } from "../src/lib/rbac/guard";
import { isSuperAdmin } from "../src/lib/rbac/super-admin";
import { PERMISSIONS } from "../src/lib/rbac/permissions";
import { TEAM_NAV_CONFIG } from "../src/lib/navigation/team-nav";

async function runTests() {
  console.log("=== RUNNING ROLE SIMULATOR & PYQ RBAC ACCEPTANCE TESTS ===");

  // 1. Verify Admin user exists and has admin rights
  const adminUser = await prisma.user.findFirst({
    where: { role: { name: "ADMIN" } },
    select: { id: true, name: true, role: true },
  });

  if (!adminUser) {
    throw new Error("Admin user not found in database");
  }
  console.log(`✓ Admin user verified: ${adminUser.name} (${adminUser.id})`);

  const isSuper1 = await isSuperAdminUser(adminUser.id);
  const isSuper2 = await isSuperAdmin(adminUser.id);
  if (!isSuper1 || !isSuper2) {
    throw new Error("Admin guard check failed for Admin");
  }
  console.log("✓ Admin guard verification passed (isSuperAdminUser & isSuperAdmin)");

  // 2. Verify Admin has QUESTION_ASSIGN permission
  const canAssign = await hasPermission(adminUser.id, PERMISSIONS.QUESTION_ASSIGN);
  if (!canAssign) {
    throw new Error("Admin does not have QUESTION_ASSIGN permission");
  }
  console.log("✓ Admin holds QUESTION_ASSIGN permission");

  // 3. Test Employee-Wise Simulation for Admin
  const adminSim = await simulateEmployee(adminUser.id);
  if (adminSim.targetUser.roleName !== "ADMIN") {
    throw new Error(`Expected roleName to be ADMIN, got ${adminSim.targetUser.roleName}`);
  }
  if (adminSim.totalGrantedCount < 50) {
    throw new Error(`Expected Admin to have >50 permissions, got ${adminSim.totalGrantedCount}`);
  }
  console.log(`✓ Admin simulation successful: ${adminSim.totalGrantedCount} permissions granted`);

  // 4. Test Employee-Wise Simulation for Teacher or SME
  const teacherOrSme = await prisma.user.findFirst({
    where: { role: { name: { in: ["TEACHER", "SME"] } } },
    select: { id: true, name: true, role: true },
  });

  if (teacherOrSme) {
    const staffSim = await simulateEmployee(teacherOrSme.id);
    if (staffSim.targetUser.roleName !== teacherOrSme.role?.name) {
      throw new Error("Staff simulation role name mismatch");
    }
    // Teacher/SME should have finance restricted
    if (!staffSim.dataScope.financeRestricted) {
      throw new Error("Expected finance to be restricted for Teacher/SME");
    }
    console.log(`✓ Staff simulation verified for ${teacherOrSme.name} (${teacherOrSme.role?.name}): Finance Restricted = true`);
  }

  // 5. Test Role-Wise Simulation
  const teacherRoleSim = await simulateRole("TEACHER");
  const smeRoleSim = await simulateRole("SME");
  const growthRoleSim = await simulateRole("CONTENT_GROWTH_EXECUTIVE");

  if (!teacherRoleSim.effectivePermissions.includes(PERMISSIONS.QUESTION_READ)) {
    throw new Error("Expected TEACHER to have question.read");
  }
  if (!smeRoleSim.effectivePermissions.includes(PERMISSIONS.QUESTION_READ)) {
    throw new Error("Expected SME to have question.read");
  }
  if (!growthRoleSim.effectivePermissions.includes(PERMISSIONS.CMS_MEDIA_MANAGE)) {
    throw new Error("Expected CONTENT_GROWTH_EXECUTIVE to have cms.media.manage");
  }
  console.log("✓ Role-Wise Simulations verified (TEACHER, SME, CONTENT_GROWTH_EXECUTIVE)");

  // 6. Test Side-by-Side Comparison
  const comp = compareSimulations(teacherRoleSim, smeRoleSim);
  if (comp.sharedPermissions.length === 0) {
    throw new Error("Expected shared permissions between Teacher and SME");
  }
  console.log(`✓ Side-by-side comparison verified: ${comp.sharedPermissions.length} shared, ${comp.exclusiveTo1.length} exclusive to Teacher, ${comp.exclusiveTo2.length} exclusive to SME`);

  // 7. Test Canonical Navigation Config
  const rolePreviewNavItem = TEAM_NAV_CONFIG.find((i) => i.href === "/team/role-preview");
  if (!rolePreviewNavItem || !rolePreviewNavItem.superAdminOnly) {
    throw new Error("Expected /team/role-preview nav item to exist and have superAdminOnly: true");
  }
  console.log("✓ Canonical Team Navigation config verified (/team/role-preview is superAdminOnly: true)");

  console.log("=== ALL ACCEPTANCE TESTS PASSED SUCCESSFULLY ===");
}

runTests()
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

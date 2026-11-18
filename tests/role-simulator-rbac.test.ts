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

  // 1. Verify Super Admin user exists and has super admin rights
  const superAdminUser = await prisma.user.findFirst({
    where: { role: { name: "SUPER_ADMIN" } },
    select: { id: true, name: true, role: true },
  });

  if (!superAdminUser) {
    throw new Error("Super Admin user not found in database");
  }
  console.log(`✓ Super Admin user verified: ${superAdminUser.name} (${superAdminUser.id})`);

  const isSuper1 = await isSuperAdminUser(superAdminUser.id);
  const isSuper2 = await isSuperAdmin(superAdminUser.id);
  if (!isSuper1 || !isSuper2) {
    throw new Error("Super admin guard check failed for Super Admin");
  }
  console.log("✓ Super Admin guard verification passed (isSuperAdminUser & isSuperAdmin)");

  // 2. Verify Super Admin has QUESTION_ASSIGN permission
  const canAssign = await hasPermission(superAdminUser.id, PERMISSIONS.QUESTION_ASSIGN);
  if (!canAssign) {
    throw new Error("Super Admin does not have QUESTION_ASSIGN permission");
  }
  console.log("✓ Super Admin holds QUESTION_ASSIGN permission");

  // 3. Test Employee-Wise Simulation for Super Admin
  const adminSim = await simulateEmployee(superAdminUser.id);
  if (adminSim.targetUser.roleName !== "SUPER_ADMIN") {
    throw new Error(`Expected roleName to be SUPER_ADMIN, got ${adminSim.targetUser.roleName}`);
  }
  if (adminSim.totalGrantedCount < 50) {
    throw new Error(`Expected Super Admin to have >50 permissions, got ${adminSim.totalGrantedCount}`);
  }
  console.log(`✓ Super Admin simulation successful: ${adminSim.totalGrantedCount} permissions granted`);

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

import { prisma } from "../src/lib/db";
import { hasPermission, getUserPermissionCodes, requirePermission, ForbiddenError } from "../src/lib/rbac/guard";
import { PERMISSIONS } from "../src/lib/rbac/permissions";

async function runTestSuite() {
  console.log("==================================================================");
  console.log("🚀 ATOMIC PATHSHALA RBAC TEST: CONTENT & DIGITAL GROWTH EXECUTIVE");
  console.log("==================================================================\n");

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      testsPassed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${detail ? `- ${detail}` : ""}`);
      testsFailed++;
    }
  }

  // Find or create test executive user
  const role = await prisma.role.findUnique({
    where: { name: "CONTENT_GROWTH_EXECUTIVE" as any },
  });

  if (!role) {
    throw new Error("CONTENT_GROWTH_EXECUTIVE role not found in database! Seed first.");
  }

  // Create temporary test user with CONTENT_GROWTH_EXECUTIVE role
  const testEmail = `test.growth.exec.${Date.now()}@atomicpathshala.com`;
  const testUser = await prisma.user.create({
    data: {
      email: testEmail,
      name: "Test Growth Executive",
      passwordHash: "test_hash_secure",
      roleId: role.id,
      department: "Marketing & Media",
      position: "Content & Digital Growth Executive",
      status: "ACTIVE",
    },
  });

  console.log(`Created test executive user: ${testUser.id} (${testUser.email})\n`);

  try {
    // 1. Employee can upload and manage videos
    const canViewMedia = await hasPermission(testUser.id, PERMISSIONS.MEDIA_VIEW);
    const canUploadMedia = await hasPermission(testUser.id, PERMISSIONS.MEDIA_UPLOAD);
    const canEditMedia = await hasPermission(testUser.id, PERMISSIONS.MEDIA_EDIT);
    const canDeleteMedia = await hasPermission(testUser.id, PERMISSIONS.MEDIA_DELETE);
    const canManageThumbnails = await hasPermission(testUser.id, PERMISSIONS.MEDIA_THUMBNAIL_MANAGE);
    assert(
      canViewMedia && canUploadMedia && canEditMedia && canDeleteMedia && canManageThumbnails,
      "1. Employee can upload and manage videos/media"
    );

    // 2. Employee can create and manage promotional content
    const canViewCampaign = await hasPermission(testUser.id, PERMISSIONS.MARKETING_CAMPAIGN_VIEW);
    const canCreateCampaign = await hasPermission(testUser.id, PERMISSIONS.MARKETING_CAMPAIGN_CREATE);
    const canEditCampaign = await hasPermission(testUser.id, PERMISSIONS.MARKETING_CAMPAIGN_EDIT);
    const canManageCreatives = await hasPermission(testUser.id, PERMISSIONS.MARKETING_CREATIVE_MANAGE);
    const canViewOffers = await hasPermission(testUser.id, PERMISSIONS.MARKETING_OFFER_VIEW);
    assert(
      canViewCampaign && canCreateCampaign && canEditCampaign && canManageCreatives && canViewOffers,
      "2. Employee can create and manage promotional content & campaigns"
    );

    // 3. Employee can manage permitted social content
    const canCreateSocial = await hasPermission(testUser.id, PERMISSIONS.SOCIAL_CONTENT_CREATE);
    const canPublishSocial = await hasPermission(testUser.id, PERMISSIONS.SOCIAL_CONTENT_PUBLISH);
    const canScheduleSocial = await hasPermission(testUser.id, PERMISSIONS.SOCIAL_CONTENT_SCHEDULE);
    const canManageReels = await hasPermission(testUser.id, PERMISSIONS.SOCIAL_REELS_MANAGE);
    const canManageStories = await hasPermission(testUser.id, PERMISSIONS.SOCIAL_STORIES_MANAGE);
    const canCreateYoutube = await hasPermission(testUser.id, PERMISSIONS.YOUTUBE_CONTENT_CREATE);
    assert(
      canCreateSocial && canPublishSocial && canScheduleSocial && canManageReels && canManageStories && canCreateYoutube,
      "3. Employee can manage permitted social content (Instagram, YouTube, Reels, Stories)"
    );

    // 4. Employee can view growth analytics
    const canViewYoutubeAnalytics = await hasPermission(testUser.id, PERMISSIONS.ANALYTICS_YOUTUBE_VIEW);
    const canViewSocialAnalytics = await hasPermission(testUser.id, PERMISSIONS.ANALYTICS_SOCIAL_VIEW);
    const canViewCampaignAnalytics = await hasPermission(testUser.id, PERMISSIONS.ANALYTICS_CAMPAIGN_VIEW);
    const canExportReports = await hasPermission(testUser.id, PERMISSIONS.ANALYTICS_REPORTS_EXPORT);
    assert(
      canViewYoutubeAnalytics && canViewSocialAnalytics && canViewCampaignAnalytics && canExportReports,
      "4. Employee can view growth analytics and export campaign reports"
    );

    // 5. Employee can access batch information in READ-ONLY mode
    const canReadBatches = await hasPermission(testUser.id, PERMISSIONS.BATCH_READ);
    const canViewBatches = await hasPermission(testUser.id, PERMISSIONS.BATCHES_VIEW);
    const canCreateBatch = await hasPermission(testUser.id, PERMISSIONS.BATCH_CREATE);
    const canDeleteBatch = await hasPermission(testUser.id, PERMISSIONS.BATCH_DELETE);
    const canManageEnrollments = await hasPermission(testUser.id, PERMISSIONS.BATCH_ENROLLMENT_MANAGE);
    assert(
      (canReadBatches || canViewBatches) && !canCreateBatch && !canDeleteBatch && !canManageEnrollments,
      "5. Employee can access batch information in READ-ONLY mode (creation/deletion blocked)"
    );

    // 6. Employee CANNOT access student financial records
    const canReadFinance = await hasPermission(testUser.id, PERMISSIONS.FINANCE_READ);
    const canApproveRefund = await hasPermission(testUser.id, PERMISSIONS.FINANCE_REFUND_APPROVE);
    const canCreateInvoice = await hasPermission(testUser.id, PERMISSIONS.FINANCE_INVOICE_CREATE);
    const canManageSubscription = await hasPermission(testUser.id, PERMISSIONS.SUBSCRIPTION_MANAGE);
    assert(
      !canReadFinance && !canApproveRefund && !canCreateInvoice && !canManageSubscription,
      "6. Employee CANNOT access student financial records, invoices or refunds"
    );

    // 7. Employee CANNOT modify courses or question banks
    const canCreateCourse = await hasPermission(testUser.id, PERMISSIONS.COURSE_CREATE);
    const canUpdateCourse = await hasPermission(testUser.id, PERMISSIONS.COURSE_UPDATE);
    const canPublishCourse = await hasPermission(testUser.id, PERMISSIONS.COURSE_PUBLISH);
    const canCreateQuestion = await hasPermission(testUser.id, PERMISSIONS.QUESTION_CREATE);
    const canUpdateQuestion = await hasPermission(testUser.id, PERMISSIONS.QUESTION_UPDATE);
    const canDeleteQuestion = await hasPermission(testUser.id, PERMISSIONS.QUESTION_DELETE);
    const canCreateTest = await hasPermission(testUser.id, PERMISSIONS.TEST_CREATE);
    const canPublishTest = await hasPermission(testUser.id, PERMISSIONS.TEST_PUBLISH);
    assert(
      !canCreateCourse && !canUpdateCourse && !canPublishCourse &&
      !canCreateQuestion && !canUpdateQuestion && !canDeleteQuestion &&
      !canCreateTest && !canPublishTest,
      "7. Employee CANNOT modify courses, question banks, or mock tests"
    );

    // 8. Employee CANNOT access administrative or security settings
    const canReadUsers = await hasPermission(testUser.id, PERMISSIONS.USER_READ);
    const canManageRoles = await hasPermission(testUser.id, PERMISSIONS.ROLE_MANAGE);
    const canManageSecurity = await hasPermission(testUser.id, PERMISSIONS.SECURITY_CONFIG_MANAGE);
    const canReadStudentDir = await hasPermission(testUser.id, PERMISSIONS.STUDENT_READ_ANY);
    assert(
      !canReadUsers && !canManageRoles && !canManageSecurity && !canReadStudentDir,
      "8. Employee CANNOT access admin user management, role matrix, or security configuration"
    );

    // 9. Direct API access to restricted endpoints is denied (throws ForbiddenError)
    let apiCallBlocked = false;
    try {
      await requirePermission(testUser.id, PERMISSIONS.FINANCE_READ);
    } catch (err) {
      if (err instanceof ForbiddenError) {
        apiCallBlocked = true;
      }
    }
    assert(
      apiCallBlocked,
      "9. Direct API access to restricted endpoint throws 403 ForbiddenError"
    );

    // 10. Super Admin can modify and revoke permissions immediately
    // Test A: Explicit user override to revoke a granted permission
    await prisma.userPermissionOverride.upsert({
      where: {
        userId_permissionCode: {
          userId: testUser.id,
          permissionCode: PERMISSIONS.MEDIA_DELETE,
        },
      },
      create: {
        userId: testUser.id,
        permissionCode: PERMISSIONS.MEDIA_DELETE,
        granted: false,
        reason: "Security lockdown test",
      },
      update: {
        granted: false,
      },
    });

    const canDeleteAfterOverride = await hasPermission(testUser.id, PERMISSIONS.MEDIA_DELETE);

    // Test B: Immediate total revocation by removing role
    await prisma.user.update({
      where: { id: testUser.id },
      data: { roleId: null },
    });

    const canViewMediaAfterRoleRemoval = await hasPermission(testUser.id, PERMISSIONS.MEDIA_VIEW);

    assert(
      !canDeleteAfterOverride && !canViewMediaAfterRoleRemoval,
      "10. Super Admin can modify and revoke permissions immediately (Overrides & Role Revocation)"
    );

  } finally {
    // Cleanup test user and overrides
    await prisma.userPermissionOverride.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    console.log(`Cleaned up test user: ${testUser.id}`);
  }

  console.log("\n==================================================================");
  console.log(`📊 TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log("==================================================================\n");

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTestSuite()
  .catch((e) => {
    console.error("Test Suite Fatal Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

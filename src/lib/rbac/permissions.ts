/**
 * RBAC Permission Catalogue
 * -------------------------
 * Every permission used anywhere in the platform MUST be declared here first,
 * then seeded into the database (see prisma/seed.ts), then attached to Roles.
 * Routes and Server Actions check permissions via `hasPermission()` — never
 * via inline role-name string comparisons.
 */

export const PERMISSIONS = {
  // Student Portal
  STUDENT_READ_SELF: "student.read.self",
  STUDENT_READ_ANY: "student.read.any",
  STUDENT_CREATE: "student.create",
  STUDENT_UPDATE: "student.update",
  STUDENT_DELETE: "student.delete",

  // Teacher / Team Portal
  TEACHER_READ: "teacher.read",
  TEACHER_CREATE: "teacher.create",
  TEACHER_UPDATE: "teacher.update",

  // Course / Content
  COURSE_READ: "course.read",
  COURSE_CREATE: "course.create",
  COURSE_UPDATE: "course.update",
  COURSE_PUBLISH: "course.publish",

  // CRM
  LEAD_READ: "crm.lead.read",
  LEAD_ASSIGN: "crm.lead.assign",
  LEAD_UPDATE: "crm.lead.update",

  // Finance
  FINANCE_READ: "finance.read",
  FINANCE_REFUND_APPROVE: "finance.refund.approve",
  FINANCE_INVOICE_CREATE: "finance.invoice.create",

  // Subscriptions — manual grant/extend/revoke for offline/cash payments
  SUBSCRIPTION_MANAGE: "subscription.manage",

  // Analytics
  ANALYTICS_VIEW: "analytics.view",
  FOUNDER_DASHBOARD_VIEW: "founder.dashboard.view",

  // Question Bank
  QUESTION_READ: "question.read",
  QUESTION_CREATE: "question.create",
  QUESTION_UPDATE: "question.update",
  QUESTION_DELETE: "question.delete",
  QUESTION_VERIFY: "question.verify",

  // Doubt Desk
  DOUBT_READ: "doubt.read",
  DOUBT_RESOLVE: "doubt.resolve",

  // Marketing — Coupons & Notifications
  COUPON_READ: "marketing.coupon.read",
  COUPON_CREATE: "marketing.coupon.create",
  COUPON_UPDATE: "marketing.coupon.update",
  COUPON_DELETE: "marketing.coupon.delete",
  NOTIFICATION_SEND: "marketing.notification.send",
  NOTIFICATION_READ: "marketing.notification.read",

  // Team Portal — baseline "can get past the team-portal gate" permission,
  // separate from any specific module permission above.
  TEAM_PORTAL_ACCESS: "team.portal.access",

  // Whiteboard (teacher-side session/practice board)
  WHITEBOARD_ACCESS: "whiteboard.access",

  // Batch System
  BATCH_READ: "batch.read",
  BATCH_CREATE: "batch.create",
  BATCH_UPDATE: "batch.update",
  BATCH_DELETE: "batch.delete",
  BATCH_ENROLLMENT_MANAGE: "batch.enrollment.manage",
  BATCH_SCHEDULE_MANAGE: "batch.schedule.manage",

  // Test Engine
  TEST_READ: "test.read",
  TEST_CREATE: "test.create",
  TEST_UPDATE: "test.update",
  TEST_PUBLISH: "test.publish",
  TEST_DELETE: "test.delete",

  // Lecture Library — recorded, on-demand video lectures (separate from
  // live classes / WhiteboardSession). Same 5-way CRUD+publish split as
  // the Test Engine: a teacher can upload/edit their own draft, only an
  // admin tier can publish it live to students.
  LECTURE_READ: "lecture.read",
  LECTURE_CREATE: "lecture.create",
  LECTURE_UPDATE: "lecture.update",
  LECTURE_PUBLISH: "lecture.publish",
  LECTURE_DELETE: "lecture.delete",

  // ID / KYC Document Management
  DOCUMENT_READ_SELF: "document.read.self",
  DOCUMENT_UPLOAD_SELF: "document.upload.self",
  DOCUMENT_READ_ANY: "document.read.any",
  DOCUMENT_VERIFY: "document.verify",

  // Faculty Onboarding Queue
  ONBOARDING_REVIEW: "onboarding.review",

  // Digital Contract / e-signature
  CONTRACT_READ_SELF: "contract.read.self",
  CONTRACT_SIGN_SELF: "contract.sign.self",
  CONTRACT_READ_ANY: "contract.read.any",
  CONTRACT_CREATE: "contract.create",

  // Penalty & Compliance Rule Engine
  PENALTY_RULE_MANAGE: "penalty.rule.manage",
  PENALTY_RECORD_CREATE: "penalty.record.create",
  PENALTY_READ_ANY: "penalty.read.any",
  PENALTY_READ_SELF: "penalty.read.self",

  // Faculty Leaderboard
  LEADERBOARD_READ: "leaderboard.read",

  // Admin / RBAC management
  ROLE_MANAGE: "admin.role.manage",
  PERMISSION_MANAGE: "admin.permission.manage",
  AUDIT_LOG_VIEW: "admin.audit.view",

  // Home Page CMS / Page Builder
  HOME_VIEW: "cms.home.view",
  HOME_CREATE: "cms.home.create",
  HOME_EDIT: "cms.home.edit",
  HOME_DELETE: "cms.home.delete",
  HOME_PUBLISH: "cms.home.publish",
  HOME_REORDER: "cms.home.reorder",
  BANNER_MANAGE: "cms.banner.manage",
  MEDIA_MANAGE: "cms.media.manage",
  FOOTER_MANAGE: "cms.footer.manage",
  FAQ_MANAGE: "cms.faq.manage",
  TESTIMONIAL_MANAGE: "cms.testimonial.manage",
  SEO_MANAGE: "cms.seo.manage",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Default permission sets per role, used by the seed script.
 * Adjust here — never hardcode role checks elsewhere in the app.
 */
export const ROLE_PERMISSION_DEFAULTS: Record<string, PermissionCode[]> = {
  STUDENT: [PERMISSIONS.STUDENT_READ_SELF, PERMISSIONS.COURSE_READ],
  PARENT: [PERMISSIONS.STUDENT_READ_SELF],
  TEACHER: [
    PERMISSIONS.TEAM_PORTAL_ACCESS,
    PERMISSIONS.TEACHER_READ,
    PERMISSIONS.STUDENT_READ_ANY,
    PERMISSIONS.COURSE_READ,
    PERMISSIONS.COURSE_UPDATE,
    PERMISSIONS.DOUBT_READ,
    PERMISSIONS.DOUBT_RESOLVE,
    PERMISSIONS.DOCUMENT_READ_SELF,
    PERMISSIONS.DOCUMENT_UPLOAD_SELF,
    PERMISSIONS.CONTRACT_READ_SELF,
    PERMISSIONS.CONTRACT_SIGN_SELF,
    PERMISSIONS.PENALTY_READ_SELF,
    PERMISSIONS.LEADERBOARD_READ,
    PERMISSIONS.WHITEBOARD_ACCESS,
    PERMISSIONS.BATCH_READ,
    PERMISSIONS.TEST_READ,
    PERMISSIONS.TEST_CREATE,
    PERMISSIONS.TEST_UPDATE,
    PERMISSIONS.LECTURE_READ,
    PERMISSIONS.LECTURE_CREATE,
    PERMISSIONS.LECTURE_UPDATE,
  ],
  ACADEMIC_HEAD: [
    PERMISSIONS.TEAM_PORTAL_ACCESS,
    PERMISSIONS.TEACHER_READ,
    PERMISSIONS.TEACHER_CREATE,
    PERMISSIONS.TEACHER_UPDATE,
    PERMISSIONS.COURSE_READ,
    PERMISSIONS.COURSE_CREATE,
    PERMISSIONS.COURSE_PUBLISH,
    PERMISSIONS.STUDENT_READ_ANY,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.QUESTION_READ,
    PERMISSIONS.QUESTION_VERIFY,
    PERMISSIONS.DOCUMENT_READ_ANY,
    PERMISSIONS.DOCUMENT_VERIFY,
    PERMISSIONS.ONBOARDING_REVIEW,
    PERMISSIONS.CONTRACT_READ_ANY,
    PERMISSIONS.CONTRACT_CREATE,
    PERMISSIONS.PENALTY_RULE_MANAGE,
    PERMISSIONS.PENALTY_RECORD_CREATE,
    PERMISSIONS.PENALTY_READ_ANY,
    PERMISSIONS.LEADERBOARD_READ,
    PERMISSIONS.BATCH_READ,
    PERMISSIONS.BATCH_CREATE,
    PERMISSIONS.BATCH_UPDATE,
    PERMISSIONS.BATCH_DELETE,
    PERMISSIONS.BATCH_ENROLLMENT_MANAGE,
    PERMISSIONS.BATCH_SCHEDULE_MANAGE,
    PERMISSIONS.TEST_READ,
    PERMISSIONS.TEST_CREATE,
    PERMISSIONS.TEST_UPDATE,
    PERMISSIONS.TEST_PUBLISH,
    PERMISSIONS.TEST_DELETE,
    PERMISSIONS.LECTURE_READ,
    PERMISSIONS.LECTURE_CREATE,
    PERMISSIONS.LECTURE_UPDATE,
    PERMISSIONS.LECTURE_PUBLISH,
    PERMISSIONS.LECTURE_DELETE,
  ],
  QUESTION_TEAM: [
    PERMISSIONS.TEAM_PORTAL_ACCESS,
    PERMISSIONS.QUESTION_READ,
    PERMISSIONS.QUESTION_CREATE,
    PERMISSIONS.QUESTION_UPDATE,
    PERMISSIONS.QUESTION_VERIFY,
    PERMISSIONS.DOUBT_READ,
    PERMISSIONS.DOUBT_RESOLVE,
  ],
  CONTENT_TEAM: [
    PERMISSIONS.TEAM_PORTAL_ACCESS,
    PERMISSIONS.COURSE_READ,
    PERMISSIONS.COURSE_CREATE,
    PERMISSIONS.COURSE_UPDATE,
    PERMISSIONS.HOME_VIEW,
    PERMISSIONS.MEDIA_MANAGE,
    PERMISSIONS.FAQ_MANAGE,
    PERMISSIONS.TESTIMONIAL_MANAGE,
  ],
  SALES: [
    PERMISSIONS.TEAM_PORTAL_ACCESS,
    PERMISSIONS.LEAD_READ,
    PERMISSIONS.LEAD_ASSIGN,
    PERMISSIONS.LEAD_UPDATE,
  ],
  SUPPORT: [
    PERMISSIONS.TEAM_PORTAL_ACCESS,
    PERMISSIONS.STUDENT_READ_ANY,
    PERMISSIONS.DOUBT_READ,
  ],
  FINANCE: [
    PERMISSIONS.TEAM_PORTAL_ACCESS,
    PERMISSIONS.FINANCE_READ,
    PERMISSIONS.FINANCE_REFUND_APPROVE,
    PERMISSIONS.FINANCE_INVOICE_CREATE,
    PERMISSIONS.SUBSCRIPTION_MANAGE,
  ],
  HR: [
    PERMISSIONS.TEAM_PORTAL_ACCESS,
    PERMISSIONS.TEACHER_READ,
    PERMISSIONS.TEACHER_CREATE,
    PERMISSIONS.TEACHER_UPDATE,
    PERMISSIONS.DOCUMENT_READ_ANY,
    PERMISSIONS.DOCUMENT_VERIFY,
    PERMISSIONS.ONBOARDING_REVIEW,
    PERMISSIONS.CONTRACT_READ_ANY,
    PERMISSIONS.CONTRACT_CREATE,
    PERMISSIONS.PENALTY_RULE_MANAGE,
    PERMISSIONS.PENALTY_RECORD_CREATE,
    PERMISSIONS.PENALTY_READ_ANY,
    PERMISSIONS.LEADERBOARD_READ,
  ],
  MARKETING: [
    PERMISSIONS.TEAM_PORTAL_ACCESS,
    PERMISSIONS.COUPON_READ,
    PERMISSIONS.COUPON_CREATE,
    PERMISSIONS.COUPON_UPDATE,
    PERMISSIONS.COUPON_DELETE,
    PERMISSIONS.NOTIFICATION_SEND,
    PERMISSIONS.NOTIFICATION_READ,
    PERMISSIONS.HOME_VIEW,
    PERMISSIONS.HOME_CREATE,
    PERMISSIONS.HOME_EDIT,
    PERMISSIONS.HOME_DELETE,
    PERMISSIONS.HOME_PUBLISH,
    PERMISSIONS.HOME_REORDER,
    PERMISSIONS.BANNER_MANAGE,
    PERMISSIONS.FOOTER_MANAGE,
    PERMISSIONS.SEO_MANAGE,
    PERMISSIONS.MEDIA_MANAGE,
  ],
  DEPARTMENT_HEAD: [
    PERMISSIONS.TEAM_PORTAL_ACCESS,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.STUDENT_READ_ANY,
    PERMISSIONS.TEACHER_READ,
    PERMISSIONS.BATCH_READ,
  ],
  SUPER_ADMIN: [PERMISSIONS.TEAM_PORTAL_ACCESS, ...Object.values(PERMISSIONS)],
  FOUNDER: [PERMISSIONS.TEAM_PORTAL_ACCESS, ...Object.values(PERMISSIONS)],
};

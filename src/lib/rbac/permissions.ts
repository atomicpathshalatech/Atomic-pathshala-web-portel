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
  // Open the student portal from the Team Portal ("Student" switch) without
  // signing in again — as the team member's own student profile, with every
  // batch open, to check what students see.
  STUDENT_VIEW_AS: "student.view_as",

  // Teacher / Team Portal
  TEACHER_READ: "teacher.read",
  TEACHER_CREATE: "teacher.create",
  TEACHER_UPDATE: "teacher.update",
  TEACHER_DELETE: "teacher.delete",
  // The Faculty Directory (all educators, their profiles, applications,
  // attendance & watch time). Super Admin only by default; grant per user.
  FACULTY_DIRECTORY: "faculty.directory",

  // Course / Content
  COURSE_READ: "course.read",
  COURSE_CREATE: "course.create",
  COURSE_UPDATE: "course.update",
  COURSE_PUBLISH: "course.publish",

  // CRM / Sales
  LEAD_READ: "crm.lead.read",
  LEAD_CREATE: "crm.lead.create",
  LEAD_ASSIGN: "crm.lead.assign",
  LEAD_UPDATE: "crm.lead.update",
  LEAD_DELETE: "crm.lead.delete",
  SALES_REPORT_VIEW: "crm.sales.report.view",

  // Finance
  FINANCE_READ: "finance.read",
  FINANCE_REFUND_APPROVE: "finance.refund.approve",
  FINANCE_INVOICE_CREATE: "finance.invoice.create",
  FINANCE_GST_MANAGE: "finance.gst.manage",
  FINANCE_BANK_MANAGE: "finance.bank.manage",
  FINANCE_EXPENSE_MANAGE: "finance.expense.manage",
  FINANCE_EXPENSE_APPROVE: "finance.expense.approve",
  FINANCE_LEDGER_VIEW: "finance.ledger.view",
  FINANCE_REPORT_EXPORT: "finance.report.export",

  // HR & Payroll
  HR_EMPLOYEE_MANAGE: "hr.employee.manage",
  HR_SALARY_STRUCTURE_MANAGE: "hr.salary.manage",
  HR_PAYROLL_PREPARE: "hr.payroll.prepare",
  HR_PAYROLL_APPROVE: "hr.payroll.approve",
  HR_PAYROLL_DISBURSE: "hr.payroll.disburse",
  HR_PAYSLIP_VIEW_ANY: "hr.payslip.view.any",

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
  QUESTION_APPROVE: "question.approve",
  QUESTION_REJECT: "question.reject",
  QUESTION_ASSIGN: "question.assign",
  QUESTION_REVIEW_1: "question.review1",
  QUESTION_REVIEW_2: "question.review2",
  QUESTION_IMPORT: "question.import",
  QUESTION_EXPORT: "question.export",

  // Doubt Desk
  DOUBT_READ: "doubt.read",
  DOUBT_RESOLVE: "doubt.resolve",
  DOUBT_REVIEW: "doubt.review",

  // Marketing — Coupons & Notifications
  COUPON_READ: "marketing.coupon.read",
  COUPON_CREATE: "marketing.coupon.create",
  COUPON_UPDATE: "marketing.coupon.update",
  COUPON_DELETE: "marketing.coupon.delete",
  NOTIFICATION_SEND: "marketing.notification.send",
  NOTIFICATION_READ: "marketing.notification.read",

  // Team Portal — baseline gate permission
  TEAM_PORTAL_ACCESS: "team.portal.access",

  // Publish new builds of the Windows / Android apps (App Releases page)
  APP_RELEASE_MANAGE: "apps.release.manage",

  // Whiteboard (teacher-side session/practice board)
  WHITEBOARD_ACCESS: "whiteboard.access",

  // Classroom (YouTube-Live based live class module, independent of Whiteboard)
  CLASSROOM_ACCESS: "classroom.access",

  // Operate ANY live class (start/end/extend/map) regardless of who teaches
  // it. Plain teachers only control classes they are assigned to.
  LIVE_CLASS_ADMIN: "live_class.admin",

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
  TEST_APPROVE: "test.approve",
  TEST_REJECT: "test.reject",
  TEST_DELETE: "test.delete",
  TEST_EXPORT: "test.export",
  TEST_IMPORT: "test.import",

  // Lecture Library
  LECTURE_READ: "lecture.read",
  LECTURE_CREATE: "lecture.create",
  LECTURE_UPDATE: "lecture.update",
  LECTURE_PUBLISH: "lecture.publish",
  LECTURE_DELETE: "lecture.delete",

  // Recorded lectures in the separate recorded-lecture storage: upload,
  // publish, archive. Admin / Super Admin hold it (they pass every check);
  // grant it to other roles from Roles & Permissions.
  RECORDED_LECTURE_MANAGE: "recorded_lecture.manage",

  // Chapter Management System
  CHAPTER_READ: "chapter.read",
  CHAPTER_CREATE: "chapter.create",
  CHAPTER_UPDATE: "chapter.update",
  CHAPTER_PUBLISH: "chapter.publish",
  CHAPTER_DELETE: "chapter.delete",
  // Admin decision on a chapter UNDER_REVIEW (approve/reject/request
  // changes) — kept separate from CHAPTER_PUBLISH/CHAPTER_CREATE so
  // review authority doesn't default onto every chapter-authoring role.
  CHAPTER_REVIEW: "chapter.review",
  // See and edit EVERY chapter, not only one's own (created by them or
  // with a lecture they teach). Super Admin has it; grant to others per user.
  CHAPTER_MANAGE_ALL: "chapter.manage_all",

  // Upload / manage the per-chapter Study Material library (modules, short
  // notes, mind maps, formula sheets, highlighted NCERT, NCERT exemplar).
  // Granted to every content-managing role below; Super Admin controls who
  // else has it via the Roles UI.
  STUDY_MATERIAL_MANAGE: "study_material.manage",

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
  GAMIFICATION_MANAGE: "gamification.manage",

  // User Management & RBAC Administration
  USER_READ: "admin.user.read",
  USER_CREATE: "admin.user.create",
  USER_UPDATE: "admin.user.update",
  USER_PROFILE_EDIT: "admin.user.profile.edit",
  USER_DELETE: "admin.user.delete",
  USER_STATUS_MANAGE: "admin.user.status",
  USER_ROLE_ASSIGN: "admin.user.role.assign",
  USER_PERMISSION_OVERRIDE: "admin.user.permission.override",
  ROLE_MANAGE: "admin.role.manage",
  PERMISSION_MANAGE: "admin.permission.manage",
  DEPARTMENT_MANAGE: "admin.department.manage",
  POSITION_MANAGE: "admin.position.manage",
  ACCESS_REQUEST_MANAGE: "admin.access.request.manage",
  AUDIT_LOG_VIEW: "admin.audit.view",
  // Invite a new staff/educator by email+phone, and approve/reject the
  // profile they submit. Assigning them a role is still a separate action
  // (USER_ROLE_ASSIGN).
  STAFF_INVITE: "admin.staff.invite",

  // Design Studio
  DESIGN_READ: "design.read",
  DESIGN_CREATE: "design.create",
  DESIGN_UPDATE: "design.update",
  DESIGN_DELETE: "design.delete",
  DESIGN_PUBLISH: "design.publish",
  DESIGN_ASSET_UPLOAD: "design.asset.upload",

  // Video Studio
  VIDEO_READ: "video.read",
  VIDEO_CREATE: "video.create",
  VIDEO_UPDATE: "video.update",
  VIDEO_DELETE: "video.delete",
  VIDEO_PUBLISH: "video.publish",
  VIDEO_UPLOAD: "video.upload",

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
  FOUNDER_MANAGE: "cms.founder.manage",

  // AI Chat / Atomic Guru
  AICHAT_ADMIN_ACCESS: "aichat.admin.access",
  AICHAT_SCHEDULE_MANAGE: "aichat.schedule.manage",
  AICHAT_QUESTION_BANK_VIEW: "aichat.questionbank.view",

  // DPP (Daily Practice Problems)
  DPP_READ: "dpp.read",
  DPP_CREATE: "dpp.create",
  DPP_UPDATE: "dpp.update",
  DPP_PUBLISH: "dpp.publish",
  DPP_APPROVE: "dpp.approve",
  DPP_REJECT: "dpp.reject",
  DPP_DELETE: "dpp.delete",
  DPP_EXPORT: "dpp.export",
  DPP_IMPORT: "dpp.import",

  // Predictor & Security
  PREDICTOR_DATA_MANAGE: "predictor.data.manage",
  SECURITY_DEVICE_MANAGE: "security.device.manage",
  SECURITY_CONFIG_MANAGE: "security.config.manage",

  // Module Studio
  MODULE_READ: "module.read",
  MODULE_CREATE: "module.create",
  MODULE_UPDATE: "module.update",
  MODULE_PUBLISH: "module.publish",
  MODULE_DELETE: "module.delete",
  MODULE_BRAND_PROFILE_MANAGE: "module.brand.manage",

  // Atomic AI Content Studio
  CONTENT_STUDIO_ACCESS: "studio.access",
  CONTENT_STUDIO_RESEARCH: "studio.research",
  CONTENT_STUDIO_SCRIPT: "studio.script",
  CONTENT_STUDIO_VOICE: "studio.voice",
  CONTENT_STUDIO_MUSIC: "studio.music",
  CONTENT_STUDIO_VIDEO: "studio.video",
  CONTENT_STUDIO_THUMBNAIL: "studio.thumbnail",
  CONTENT_STUDIO_SEO: "studio.seo",
  CONTENT_STUDIO_SLIDES: "studio.slides",
  CONTENT_STUDIO_ASSETS: "studio.assets",
  CONTENT_STUDIO_EXPORT: "studio.export",
  CONTENT_STUDIO_DELETE: "studio.delete",
  CONTENT_STUDIO_COST_VIEW: "studio.cost.view",
  CONTENT_STUDIO_PROJECT_CREATE: "studio.project.create",
  CONTENT_STUDIO_PROJECT_READ: "studio.project.read",
  CONTENT_STUDIO_PROJECT_UPDATE: "studio.project.update",
  CONTENT_STUDIO_PROJECT_APPROVE: "studio.project.approve",
  CONTENT_STUDIO_AI_GENERATE: "studio.ai.generate",
  CONTENT_STUDIO_VIDEO_RENDER: "studio.video.render",
  CONTENT_STUDIO_PROVIDER_MANAGE: "studio.provider.manage",
  CONTENT_STUDIO_BUDGET_MANAGE: "studio.budget.manage",
  CONTENT_STUDIO_AUDIT_VIEW: "studio.audit.view",

  // Communication Center — Admin-only (see ROLE_PERMISSION_DEFAULTS: not
  // granted to TEACHER or any non-admin role by default). Gates the whole
  // /team/communication surface and its APIs, the same way STUDENT_READ_ANY
  // gates Student Management.
  COMMUNICATION_CENTER_ACCESS: "communication.center.access",
  EMAIL_LOG_READ: "communication.email_log.read",
  EMAIL_TEMPLATE_MANAGE: "communication.email_template.manage",
  EMAIL_CAMPAIGN_MANAGE: "communication.email_campaign.manage",
  BIRTHDAY_AUTOMATION_MANAGE: "communication.birthday.manage",

  // WhatsApp Automation & Campaigns
  WHATSAPP_MANAGE: "whatsapp.manage",
  WHATSAPP_CAMPAIGN_MANAGE: "whatsapp.campaign.manage",
  WHATSAPP_CONTACT_MANAGE: "whatsapp.contact.manage",
  WHATSAPP_READ: "whatsapp.read",

  // Messaging & In-App Direct Communication
  MESSAGE_READ: "message.read",
  MESSAGE_SEND: "message.send",
  MESSAGE_READ_ANY: "message.read.any",

  // Video & Media Management (Content & Digital Growth)
  MEDIA_VIEW: "media.view",
  MEDIA_UPLOAD: "media.upload",
  MEDIA_EDIT: "media.edit",
  MEDIA_DELETE: "media.delete",
  MEDIA_DOWNLOAD: "media.download",
  MEDIA_THUMBNAIL_MANAGE: "media.thumbnail.manage",
  MEDIA_ASSETS_MANAGE: "media.assets.manage",

  // YouTube Management
  YOUTUBE_CONTENT_VIEW: "youtube.content.view",
  YOUTUBE_CONTENT_CREATE: "youtube.content.create",
  YOUTUBE_CONTENT_EDIT: "youtube.content.edit",
  YOUTUBE_CONTENT_SCHEDULE: "youtube.content.schedule",
  YOUTUBE_THUMBNAIL_MANAGE: "youtube.thumbnail.manage",
  YOUTUBE_PLAYLIST_MANAGE: "youtube.playlist.manage",
  YOUTUBE_ANALYTICS_VIEW: "youtube.analytics.view",
  YOUTUBE_COMMUNITY_DRAFT: "youtube.community.draft",

  // Instagram & Social Media
  SOCIAL_CONTENT_VIEW: "social.content.view",
  SOCIAL_CONTENT_CREATE: "social.content.create",
  SOCIAL_CONTENT_EDIT: "social.content.edit",
  SOCIAL_CONTENT_SCHEDULE: "social.content.schedule",
  SOCIAL_CONTENT_PUBLISH: "social.content.publish",
  SOCIAL_STORIES_MANAGE: "social.stories.manage",
  SOCIAL_REELS_MANAGE: "social.reels.manage",
  SOCIAL_ANALYTICS_VIEW: "social.analytics.view",

  // Marketing & Promotions
  MARKETING_CAMPAIGN_VIEW: "marketing.campaign.view",
  MARKETING_CAMPAIGN_CREATE: "marketing.campaign.create",
  MARKETING_CAMPAIGN_EDIT: "marketing.campaign.edit",
  MARKETING_CREATIVE_MANAGE: "marketing.creative.manage",
  MARKETING_OFFER_VIEW: "marketing.offer.view",
  MARKETING_CAMPAIGN_ANALYTICS: "marketing.campaign.analytics",

  // Content & SEO
  SEO_METADATA_VIEW: "seo.metadata.view",
  SEO_METADATA_CREATE: "seo.metadata.create",
  SEO_METADATA_EDIT: "seo.metadata.edit",
  CONTENT_CALENDAR_MANAGE: "content.calendar.manage",
  CONTENT_COPYWRITING_MANAGE: "content.copywriting.manage",
  CONTENT_LECTURE_METADATA_EDIT: "content.lecture.metadata.edit",

  // Course Information (Read-Only)
  COURSES_VIEW: "courses.view",
  BATCHES_VIEW: "batches.view",
  FACULTY_VIEW: "faculty.view",
  SCHEDULE_VIEW: "schedule.view",
  PROMOTIONAL_PRICING_VIEW: "promotional.pricing.view",

  // Analytics
  ANALYTICS_YOUTUBE_VIEW: "analytics.youtube.view",
  ANALYTICS_INSTAGRAM_VIEW: "analytics.instagram.view",
  ANALYTICS_SOCIAL_VIEW: "analytics.social.view",
  ANALYTICS_CAMPAIGN_VIEW: "analytics.campaign.view",
  ANALYTICS_REPORTS_EXPORT: "analytics.reports.export",

  // Communication
  COMMUNICATION_DRAFT_CREATE: "communication.draft.create",
  COMMUNICATION_DRAFT_EDIT: "communication.draft.edit",
  COMMUNICATION_APPROVAL_SUBMIT: "communication.approval.submit",
  COMMUNICATION_CAMPAIGN_VIEW: "communication.campaign.view",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Default permission sets per role.
 */
export const ROLE_PERMISSION_DEFAULTS: Record<string, PermissionCode[]> = {
  STUDENT: [PERMISSIONS.STUDENT_READ_SELF, PERMISSIONS.COURSE_READ, PERMISSIONS.MESSAGE_READ, PERMISSIONS.MESSAGE_SEND],
  PARENT: [PERMISSIONS.STUDENT_READ_SELF],
  TEACHER: [
    PERMISSIONS.TEAM_PORTAL_ACCESS,
    PERMISSIONS.TEACHER_READ,
    // Deliberately NOT PERMISSIONS.STUDENT_READ_ANY — Student Management
    // (the student directory: profiles, contact info, academic status,
    // batch/course access grants) is ADMIN/FOUNDER only. A
    // teacher's own view of "which students are in my batch" is served by
    // batch/attendance/doubt endpoints scoped to their own batches, none of
    // which require this permission. See /team/students/page.tsx,
    // /api/team/students/*, and lib/search/scope.ts — all gate on exactly
    // this permission, so removing it here removes teacher access
    // everywhere at once. (Also removed from the TEACHER row in the DB
    // RolePermission table — the code default alone does not retract an
    // already-seeded DB grant.)
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
    PERMISSIONS.CLASSROOM_ACCESS,
    PERMISSIONS.BATCH_READ,
    PERMISSIONS.TEST_READ,
    PERMISSIONS.TEST_CREATE,
    PERMISSIONS.TEST_UPDATE,
    PERMISSIONS.LECTURE_READ,
    PERMISSIONS.LECTURE_CREATE,
    PERMISSIONS.LECTURE_UPDATE,
    PERMISSIONS.CHAPTER_READ,
    PERMISSIONS.CHAPTER_CREATE,
    PERMISSIONS.CHAPTER_UPDATE,
    PERMISSIONS.STUDY_MATERIAL_MANAGE,
    PERMISSIONS.AICHAT_SCHEDULE_MANAGE,
    PERMISSIONS.AICHAT_QUESTION_BANK_VIEW,
    PERMISSIONS.DPP_READ,
    PERMISSIONS.DPP_CREATE,
    PERMISSIONS.DPP_UPDATE,
    PERMISSIONS.QUESTION_READ,
    PERMISSIONS.QUESTION_CREATE,
    PERMISSIONS.QUESTION_REVIEW_1,
    PERMISSIONS.QUESTION_REVIEW_2,
    PERMISSIONS.MESSAGE_READ,
    PERMISSIONS.MESSAGE_SEND,
  ],
  CONTENT_CREATOR: [
    PERMISSIONS.TEAM_PORTAL_ACCESS,
    PERMISSIONS.QUESTION_READ,
    PERMISSIONS.QUESTION_CREATE,
    PERMISSIONS.QUESTION_UPDATE,
    PERMISSIONS.QUESTION_VERIFY,
    PERMISSIONS.QUESTION_IMPORT,
    PERMISSIONS.QUESTION_EXPORT,
    PERMISSIONS.TEST_READ,
    PERMISSIONS.TEST_CREATE,
    PERMISSIONS.TEST_UPDATE,
    PERMISSIONS.DPP_READ,
    PERMISSIONS.DPP_CREATE,
    PERMISSIONS.DPP_UPDATE,
    PERMISSIONS.DOUBT_READ,
    PERMISSIONS.DOUBT_RESOLVE,
    PERMISSIONS.COURSE_READ,
    PERMISSIONS.CHAPTER_READ,
    PERMISSIONS.CHAPTER_CREATE,
    PERMISSIONS.CHAPTER_UPDATE,
    PERMISSIONS.STUDY_MATERIAL_MANAGE,
  ],
  SME: [
    PERMISSIONS.TEAM_PORTAL_ACCESS,
    PERMISSIONS.QUESTION_READ,
    PERMISSIONS.QUESTION_UPDATE,
    PERMISSIONS.QUESTION_APPROVE,
    PERMISSIONS.QUESTION_REJECT,
    PERMISSIONS.QUESTION_VERIFY,
    PERMISSIONS.TEST_READ,
    PERMISSIONS.TEST_APPROVE,
    PERMISSIONS.TEST_REJECT,
    PERMISSIONS.DPP_READ,
    PERMISSIONS.DPP_APPROVE,
    PERMISSIONS.DPP_REJECT,
    PERMISSIONS.DOUBT_READ,
    PERMISSIONS.DOUBT_REVIEW,
    PERMISSIONS.CHAPTER_READ,
  ],
  SALES: [
    PERMISSIONS.TEAM_PORTAL_ACCESS,
    PERMISSIONS.LEAD_READ,
    PERMISSIONS.LEAD_CREATE,
    PERMISSIONS.LEAD_ASSIGN,
    PERMISSIONS.LEAD_UPDATE,
    PERMISSIONS.SALES_REPORT_VIEW,
  ],
  DESIGNER: [
    PERMISSIONS.TEAM_PORTAL_ACCESS,
    PERMISSIONS.DESIGN_READ,
    PERMISSIONS.DESIGN_CREATE,
    PERMISSIONS.DESIGN_UPDATE,
    PERMISSIONS.DESIGN_ASSET_UPLOAD,
    PERMISSIONS.COURSE_READ,
    PERMISSIONS.CHAPTER_READ,
    PERMISSIONS.MEDIA_MANAGE,
    PERMISSIONS.CONTENT_STUDIO_ACCESS,
    PERMISSIONS.CONTENT_STUDIO_THUMBNAIL,
    PERMISSIONS.CONTENT_STUDIO_SLIDES,
    PERMISSIONS.CONTENT_STUDIO_ASSETS,
    PERMISSIONS.CONTENT_STUDIO_EXPORT,
    PERMISSIONS.CONTENT_STUDIO_PROJECT_READ,
    PERMISSIONS.CONTENT_STUDIO_PROJECT_CREATE,
    PERMISSIONS.CONTENT_STUDIO_PROJECT_UPDATE,
    PERMISSIONS.CONTENT_STUDIO_AI_GENERATE,
  ],
  VIDEO_EDITOR: [
    PERMISSIONS.TEAM_PORTAL_ACCESS,
    PERMISSIONS.VIDEO_READ,
    PERMISSIONS.VIDEO_CREATE,
    PERMISSIONS.VIDEO_UPDATE,
    PERMISSIONS.VIDEO_UPLOAD,
    PERMISSIONS.LECTURE_READ,
    PERMISSIONS.LECTURE_CREATE,
    PERMISSIONS.LECTURE_UPDATE,
    PERMISSIONS.CHAPTER_READ,
    PERMISSIONS.CONTENT_STUDIO_ACCESS,
    PERMISSIONS.CONTENT_STUDIO_VIDEO,
    PERMISSIONS.CONTENT_STUDIO_VOICE,
    PERMISSIONS.CONTENT_STUDIO_MUSIC,
    PERMISSIONS.CONTENT_STUDIO_ASSETS,
    PERMISSIONS.CONTENT_STUDIO_EXPORT,
    PERMISSIONS.CONTENT_STUDIO_PROJECT_READ,
    PERMISSIONS.CONTENT_STUDIO_PROJECT_CREATE,
    PERMISSIONS.CONTENT_STUDIO_PROJECT_UPDATE,
    PERMISSIONS.CONTENT_STUDIO_AI_GENERATE,
    PERMISSIONS.CONTENT_STUDIO_VIDEO_RENDER,
  ],
  CONTENT_GROWTH_EXECUTIVE: [
    PERMISSIONS.TEAM_PORTAL_ACCESS,
    PERMISSIONS.CONTENT_STUDIO_ACCESS,
    PERMISSIONS.CONTENT_STUDIO_RESEARCH,
    PERMISSIONS.CONTENT_STUDIO_SCRIPT,
    PERMISSIONS.CONTENT_STUDIO_SEO,
    PERMISSIONS.CONTENT_STUDIO_THUMBNAIL,
    PERMISSIONS.CONTENT_STUDIO_ASSETS,
    PERMISSIONS.CONTENT_STUDIO_EXPORT,
    PERMISSIONS.CONTENT_STUDIO_PROJECT_READ,
    PERMISSIONS.CONTENT_STUDIO_PROJECT_CREATE,
    PERMISSIONS.CONTENT_STUDIO_PROJECT_UPDATE,
    PERMISSIONS.CONTENT_STUDIO_AI_GENERATE,
    PERMISSIONS.CONTENT_STUDIO_VIDEO_RENDER,
    // Video & Media Management
    PERMISSIONS.MEDIA_VIEW,
    PERMISSIONS.MEDIA_UPLOAD,
    PERMISSIONS.MEDIA_EDIT,
    PERMISSIONS.MEDIA_DELETE,
    PERMISSIONS.MEDIA_DOWNLOAD,
    PERMISSIONS.MEDIA_THUMBNAIL_MANAGE,
    PERMISSIONS.MEDIA_ASSETS_MANAGE,
    // YouTube Management
    PERMISSIONS.YOUTUBE_CONTENT_VIEW,
    PERMISSIONS.YOUTUBE_CONTENT_CREATE,
    PERMISSIONS.YOUTUBE_CONTENT_EDIT,
    PERMISSIONS.YOUTUBE_CONTENT_SCHEDULE,
    PERMISSIONS.YOUTUBE_THUMBNAIL_MANAGE,
    PERMISSIONS.YOUTUBE_PLAYLIST_MANAGE,
    PERMISSIONS.YOUTUBE_ANALYTICS_VIEW,
    PERMISSIONS.YOUTUBE_COMMUNITY_DRAFT,
    // Instagram & Social Media
    PERMISSIONS.SOCIAL_CONTENT_VIEW,
    PERMISSIONS.SOCIAL_CONTENT_CREATE,
    PERMISSIONS.SOCIAL_CONTENT_EDIT,
    PERMISSIONS.SOCIAL_CONTENT_SCHEDULE,
    PERMISSIONS.SOCIAL_CONTENT_PUBLISH,
    PERMISSIONS.SOCIAL_STORIES_MANAGE,
    PERMISSIONS.SOCIAL_REELS_MANAGE,
    PERMISSIONS.SOCIAL_ANALYTICS_VIEW,
    // Marketing & Promotions
    PERMISSIONS.MARKETING_CAMPAIGN_VIEW,
    PERMISSIONS.MARKETING_CAMPAIGN_CREATE,
    PERMISSIONS.MARKETING_CAMPAIGN_EDIT,
    PERMISSIONS.MARKETING_CREATIVE_MANAGE,
    PERMISSIONS.MARKETING_OFFER_VIEW,
    PERMISSIONS.MARKETING_CAMPAIGN_ANALYTICS,
    // Content & SEO
    PERMISSIONS.SEO_METADATA_VIEW,
    PERMISSIONS.SEO_METADATA_CREATE,
    PERMISSIONS.SEO_METADATA_EDIT,
    PERMISSIONS.CONTENT_CALENDAR_MANAGE,
    PERMISSIONS.CONTENT_COPYWRITING_MANAGE,
    PERMISSIONS.CONTENT_LECTURE_METADATA_EDIT,
    // Course Information (Read-only)
    PERMISSIONS.COURSES_VIEW,
    PERMISSIONS.BATCHES_VIEW,
    PERMISSIONS.FACULTY_VIEW,
    PERMISSIONS.SCHEDULE_VIEW,
    PERMISSIONS.PROMOTIONAL_PRICING_VIEW,
    // Analytics
    PERMISSIONS.ANALYTICS_YOUTUBE_VIEW,
    PERMISSIONS.ANALYTICS_INSTAGRAM_VIEW,
    PERMISSIONS.ANALYTICS_SOCIAL_VIEW,
    PERMISSIONS.ANALYTICS_CAMPAIGN_VIEW,
    PERMISSIONS.ANALYTICS_REPORTS_EXPORT,
    // Communication
    PERMISSIONS.COMMUNICATION_DRAFT_CREATE,
    PERMISSIONS.COMMUNICATION_DRAFT_EDIT,
    PERMISSIONS.COMMUNICATION_APPROVAL_SUBMIT,
    PERMISSIONS.COMMUNICATION_CAMPAIGN_VIEW,
    // Baseline aliases so read-only batch/course/media pages work out of the box
    PERMISSIONS.COURSE_READ,
    PERMISSIONS.BATCH_READ,
    PERMISSIONS.MEDIA_MANAGE,
    PERMISSIONS.VIDEO_READ,
    PERMISSIONS.DESIGN_READ,
    PERMISSIONS.ANALYTICS_VIEW,
  ],
  SUB_ADMIN: [
    PERMISSIONS.TEAM_PORTAL_ACCESS,
    PERMISSIONS.QUESTION_READ,
    PERMISSIONS.QUESTION_CREATE,
    PERMISSIONS.QUESTION_UPDATE,
    PERMISSIONS.QUESTION_DELETE,
    PERMISSIONS.QUESTION_VERIFY,
    PERMISSIONS.QUESTION_APPROVE,
    PERMISSIONS.QUESTION_REJECT,
    PERMISSIONS.DPP_READ,
    PERMISSIONS.DPP_CREATE,
    PERMISSIONS.DPP_UPDATE,
    PERMISSIONS.DPP_PUBLISH,
    PERMISSIONS.DPP_DELETE,
    PERMISSIONS.TEST_READ,
    PERMISSIONS.TEST_CREATE,
    PERMISSIONS.TEST_UPDATE,
    PERMISSIONS.TEST_PUBLISH,
    PERMISSIONS.TEST_DELETE,
    PERMISSIONS.PREDICTOR_DATA_MANAGE,
    PERMISSIONS.SECURITY_DEVICE_MANAGE,
    PERMISSIONS.SECURITY_CONFIG_MANAGE,
    PERMISSIONS.LEADERBOARD_READ,
    PERMISSIONS.BATCH_READ,
    PERMISSIONS.STUDENT_READ_ANY,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.MESSAGE_READ,
    PERMISSIONS.MESSAGE_SEND,
    PERMISSIONS.MESSAGE_READ_ANY,
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
    PERMISSIONS.QUESTION_APPROVE,
    PERMISSIONS.QUESTION_REJECT,
    PERMISSIONS.BATCH_READ,
    PERMISSIONS.BATCH_CREATE,
    PERMISSIONS.BATCH_UPDATE,
    PERMISSIONS.LIVE_CLASS_ADMIN,
    PERMISSIONS.BATCH_DELETE,
    PERMISSIONS.TEST_READ,
    PERMISSIONS.TEST_CREATE,
    PERMISSIONS.TEST_UPDATE,
    PERMISSIONS.TEST_PUBLISH,
    PERMISSIONS.LECTURE_READ,
    PERMISSIONS.LECTURE_CREATE,
    PERMISSIONS.LECTURE_UPDATE,
    PERMISSIONS.CHAPTER_READ,
    PERMISSIONS.CHAPTER_CREATE,
    PERMISSIONS.CHAPTER_UPDATE,
    PERMISSIONS.STUDY_MATERIAL_MANAGE,
    PERMISSIONS.DPP_READ,
    PERMISSIONS.DPP_CREATE,
    PERMISSIONS.DPP_UPDATE,
  ],
  QUESTION_TEAM: [
    PERMISSIONS.TEAM_PORTAL_ACCESS,
    PERMISSIONS.QUESTION_READ,
    PERMISSIONS.QUESTION_CREATE,
    PERMISSIONS.QUESTION_UPDATE,
    PERMISSIONS.QUESTION_VERIFY,
    PERMISSIONS.QUESTION_REVIEW_1,
    PERMISSIONS.QUESTION_REVIEW_2,
    PERMISSIONS.DOUBT_READ,
    PERMISSIONS.DOUBT_RESOLVE,
    PERMISSIONS.DPP_READ,
    PERMISSIONS.DPP_CREATE,
    PERMISSIONS.DPP_UPDATE,
  ],
  CONTENT_TEAM: [
    PERMISSIONS.TEAM_PORTAL_ACCESS,
    PERMISSIONS.COURSE_READ,
    PERMISSIONS.COURSE_CREATE,
    PERMISSIONS.COURSE_UPDATE,
    PERMISSIONS.CHAPTER_READ,
    PERMISSIONS.CHAPTER_CREATE,
    PERMISSIONS.CHAPTER_UPDATE,
    PERMISSIONS.STUDY_MATERIAL_MANAGE,
    PERMISSIONS.CHAPTER_PUBLISH,
    PERMISSIONS.HOME_VIEW,
    PERMISSIONS.MEDIA_MANAGE,
    PERMISSIONS.FAQ_MANAGE,
    PERMISSIONS.TESTIMONIAL_MANAGE,
    PERMISSIONS.FOUNDER_MANAGE,
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
    PERMISSIONS.FINANCE_GST_MANAGE,
    PERMISSIONS.FINANCE_BANK_MANAGE,
    PERMISSIONS.FINANCE_EXPENSE_MANAGE,
    PERMISSIONS.FINANCE_EXPENSE_APPROVE,
    PERMISSIONS.FINANCE_LEDGER_VIEW,
    PERMISSIONS.FINANCE_REPORT_EXPORT,
    PERMISSIONS.HR_PAYROLL_APPROVE,
    PERMISSIONS.HR_PAYROLL_DISBURSE,
    PERMISSIONS.HR_PAYSLIP_VIEW_ANY,
    PERMISSIONS.SUBSCRIPTION_MANAGE,
  ],
  HR: [
    PERMISSIONS.TEAM_PORTAL_ACCESS,
    PERMISSIONS.TEACHER_READ,
    PERMISSIONS.TEACHER_CREATE,
    PERMISSIONS.TEACHER_UPDATE,
    PERMISSIONS.STAFF_INVITE,
    PERMISSIONS.DOCUMENT_READ_ANY,
    PERMISSIONS.DOCUMENT_VERIFY,
    PERMISSIONS.ONBOARDING_REVIEW,
    PERMISSIONS.CONTRACT_READ_ANY,
    PERMISSIONS.CONTRACT_CREATE,
    PERMISSIONS.LEADERBOARD_READ,
    PERMISSIONS.HR_EMPLOYEE_MANAGE,
    PERMISSIONS.HR_SALARY_STRUCTURE_MANAGE,
    PERMISSIONS.HR_PAYROLL_PREPARE,
    PERMISSIONS.HR_PAYSLIP_VIEW_ANY,
  ],
  MARKETING: [
    PERMISSIONS.TEAM_PORTAL_ACCESS,
    PERMISSIONS.COUPON_READ,
    PERMISSIONS.COUPON_CREATE,
    PERMISSIONS.COUPON_UPDATE,
    PERMISSIONS.COUPON_DELETE,
    PERMISSIONS.NOTIFICATION_SEND,
    PERMISSIONS.NOTIFICATION_READ,
    PERMISSIONS.WHATSAPP_CAMPAIGN_MANAGE,
    PERMISSIONS.WHATSAPP_CONTACT_MANAGE,
    PERMISSIONS.WHATSAPP_READ,
    PERMISSIONS.HOME_VIEW,
    PERMISSIONS.BANNER_MANAGE,
    PERMISSIONS.FOUNDER_MANAGE,
  ],
  DEPARTMENT_HEAD: [
    PERMISSIONS.TEAM_PORTAL_ACCESS,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.STUDENT_READ_ANY,
    PERMISSIONS.TEACHER_READ,
    PERMISSIONS.BATCH_READ,
    PERMISSIONS.CONTENT_STUDIO_ACCESS,
    PERMISSIONS.CONTENT_STUDIO_PROJECT_READ,
    PERMISSIONS.CONTENT_STUDIO_PROJECT_UPDATE,
    PERMISSIONS.CONTENT_STUDIO_PROJECT_APPROVE,
    PERMISSIONS.CONTENT_STUDIO_BUDGET_MANAGE,
    PERMISSIONS.CONTENT_STUDIO_AUDIT_VIEW,
  ],
  ADMIN: [PERMISSIONS.TEAM_PORTAL_ACCESS, ...Object.values(PERMISSIONS)],
  FOUNDER: [PERMISSIONS.TEAM_PORTAL_ACCESS, ...Object.values(PERMISSIONS)],
};

export const VALID_GLOBAL_ROLES = [
  "ADMIN",
  "FOUNDER",
  "SUB_ADMIN",
  "TEACHER",
  "ACADEMIC_HEAD",
  "DEPARTMENT_HEAD",
  "CONTENT_GROWTH_EXECUTIVE",
  "CONTENT_CREATOR",
  "CONTENT_TEAM",
  "QUESTION_TEAM",
  "SME",
  "SALES",
  "SUPPORT",
  "FINANCE",
  "HR",
  "MARKETING",
  "DESIGNER",
  "VIDEO_EDITOR",
  "STUDENT",
  "PARENT",
  "GUEST",
] as const;

export type GlobalRoleName = (typeof VALID_GLOBAL_ROLES)[number];

export function parseGlobalRole(input: unknown): GlobalRoleName | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Direct match
  if (VALID_GLOBAL_ROLES.includes(trimmed as GlobalRoleName)) {
    return trimmed as GlobalRoleName;
  }

  // 2. Normalized (uppercase + underscore)
  const normalized = trimmed.toUpperCase().replace(/[\s-]+/g, "_") as GlobalRoleName;
  if (VALID_GLOBAL_ROLES.includes(normalized)) {
    return normalized;
  }

  // 3. Keyword / title heuristic matching
  const upper = trimmed.toUpperCase();
  if (upper.includes("ADMIN") || upper.includes("SUPER_ADMIN") || upper.includes("SUPER ADMIN")) return "ADMIN";
  if (upper.includes("FOUNDER")) return "FOUNDER";
  if (upper.includes("ACADEMIC_HEAD") || upper.includes("ACADEMIC HEAD")) return "ACADEMIC_HEAD";
  if (upper.includes("DEPARTMENT_HEAD") || upper.includes("DEPARTMENT HEAD")) return "DEPARTMENT_HEAD";
  if (upper.includes("SUB_ADMIN") || upper.includes("SUB ADMIN")) return "SUB_ADMIN";
  if (upper.includes("ADMIN")) return "ADMIN";
  if (upper.includes("TEACHER") || upper.includes("EDUCATOR") || upper.includes("FACULTY")) return "TEACHER";
  if (upper.includes("CONTENT_GROWTH_EXECUTIVE") || upper.includes("CONTENT & DIGITAL GROWTH") || upper.includes("GROWTH EXECUTIVE")) return "CONTENT_GROWTH_EXECUTIVE";
  if (upper.includes("CONTENT_CREATOR") || upper.includes("CONTENT CREATOR")) return "CONTENT_CREATOR";
  if (upper.includes("CONTENT_TEAM") || upper.includes("CONTENT TEAM")) return "CONTENT_TEAM";
  if (upper.includes("QUESTION_TEAM") || upper.includes("QUESTION TEAM")) return "QUESTION_TEAM";
  if (upper.includes("SME") || upper.includes("SUBJECT MATTER")) return "SME";
  if (upper.includes("SALES")) return "SALES";
  if (upper.includes("SUPPORT")) return "SUPPORT";
  if (upper.includes("FINANCE")) return "FINANCE";
  if (upper.includes("HR") || upper.includes("HUMAN RESOURCE")) return "HR";
  if (upper.includes("MARKETING")) return "MARKETING";
  if (upper.includes("DESIGNER")) return "DESIGNER";
  if (upper.includes("VIDEO_EDITOR") || upper.includes("VIDEO EDITOR")) return "VIDEO_EDITOR";
  if (upper.includes("STUDENT")) return "STUDENT";
  if (upper.includes("PARENT")) return "PARENT";

  return null;
}

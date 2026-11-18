import { PERMISSIONS } from "@/lib/rbac/permissions";

export interface TeamNavSubItem {
  href: string;
  label: string;
  icon: string;
  permission: string;
  superAdminOnly?: boolean;
  badge?: string;
}

export interface TeamNavDepartment {
  id: string;
  title: string;
  icon: string;
  description: string;
  items: TeamNavSubItem[];
}

export const ATOMIC_OPS_DEPARTMENTS: TeamNavDepartment[] = [
  {
    id: "overview",
    title: "Overview",
    icon: "dashboard",
    description: "Executive control center, executive KPIs, and timetable",
    items: [
      { href: "/team", label: "Executive Dashboard", icon: "space_dashboard", permission: PERMISSIONS.TEAM_PORTAL_ACCESS },
      { href: "/team/messages", label: "Messages & Inbox", icon: "forum", permission: PERMISSIONS.MESSAGE_READ },
      { href: "/team/my-schedule", label: "My Schedule & Timetable", icon: "calendar_month", permission: PERMISSIONS.WHITEBOARD_ACCESS },
      { href: "/team/leaderboard", label: "Academic Leaderboard", icon: "leaderboard", permission: PERMISSIONS.LEADERBOARD_READ },
      { href: "/", label: "Public Website", icon: "public", permission: PERMISSIONS.TEAM_PORTAL_ACCESS },
    ],
  },
  {
    id: "people-hr",
    title: "People & HR",
    icon: "badge",
    description: "Staff, faculty, student directory, ID cards, and permissions",
    items: [
      { href: "/team/students", label: "Student Management", icon: "school", permission: PERMISSIONS.STUDENT_READ_ANY },
      { href: "/team/faculty", label: "Faculty Directory", icon: "person_celebrate", permission: PERMISSIONS.FACULTY_DIRECTORY },
      { href: "/team/users", label: "Team & Staff Management", icon: "badge", permission: PERMISSIONS.USER_READ },
      { href: "/team/id-cards", label: "ID Cards & Certificates", icon: "id_card", permission: PERMISSIONS.USER_STATUS_MANAGE },
      { href: "/team/employees", label: "Employee Verification", icon: "verified", permission: PERMISSIONS.FACULTY_DIRECTORY },
      { href: "/team/invitations", label: "Staff Invitations", icon: "mail", permission: PERMISSIONS.STAFF_INVITE },
      { href: "/team/roles", label: "Roles & Permission Matrix", icon: "security", permission: PERMISSIONS.ROLE_MANAGE },
      { href: "/team/departments", label: "Departments & Positions", icon: "corporate_fare", permission: PERMISSIONS.DEPARTMENT_MANAGE },
      { href: "/team/onboarding", label: "Staff Onboarding", icon: "pending_actions", permission: PERMISSIONS.ONBOARDING_REVIEW },
      { href: "/team/contracts", label: "Contracts & Agreements", icon: "description", permission: PERMISSIONS.CONTRACT_READ_ANY },
      { href: "/team/documents", label: "My Documents", icon: "folder_shared", permission: PERMISSIONS.DOCUMENT_UPLOAD_SELF },
      { href: "/team/compliance", label: "Compliance & Conduct", icon: "gavel", permission: PERMISSIONS.PENALTY_READ_SELF },
      { href: "/team/id-card", label: "My Digital ID Card", icon: "contact_emergency", permission: PERMISSIONS.TEAM_PORTAL_ACCESS },
    ],
  },
  {
    id: "academic",
    title: "Academic Management",
    icon: "school",
    description: "Batches, curriculum, chapters, and timetable scheduling",
    items: [
      { href: "/team/batches", label: "Batches", icon: "groups", permission: PERMISSIONS.BATCH_READ },
      { href: "/team/chapters", label: "Curriculum & Chapters", icon: "auto_stories", permission: PERMISSIONS.CHAPTER_READ },
      { href: "/team/my-schedule", label: "Academic Timetable", icon: "schedule", permission: PERMISSIONS.WHITEBOARD_ACCESS },
      { href: "/team/performance", label: "Performance Boards", icon: "monitoring", permission: PERMISSIONS.TEAM_PORTAL_ACCESS, superAdminOnly: true },
      { href: "/team/live-diagnostics", label: "Live Diagnostics", icon: "monitor_heart", permission: PERMISSIONS.TEAM_PORTAL_ACCESS, superAdminOnly: true },
      { href: "/team/predictor", label: "Rank & College Predictor", icon: "insights", permission: PERMISSIONS.PREDICTOR_DATA_MANAGE },
    ],
  },
  {
    id: "learning",
    title: "Learning Management",
    icon: "video_library",
    description: "Live classroom, whiteboard studio, recorded lectures, and content studio",
    items: [
      { href: "/team/live-studio", label: "Live Classroom (Studio)", icon: "videocam", permission: PERMISSIONS.WHITEBOARD_ACCESS },
      { href: "/team/whiteboard", label: "Whiteboard Studio", icon: "draw", permission: PERMISSIONS.WHITEBOARD_ACCESS },
      { href: "/team/recorded-lectures", label: "Recorded Lectures", icon: "video_library", permission: PERMISSIONS.LECTURE_READ, superAdminOnly: true },
      { href: "/team/study-material", label: "Study Material", icon: "folder_open", permission: PERMISSIONS.STUDY_MATERIAL_MANAGE },
      { href: "/team/ncert", label: "NCERT Practice Hub", icon: "menu_book", permission: PERMISSIONS.CHAPTER_READ },
      { href: "/team/board-exam", label: "Board Exam Hub", icon: "history_edu", permission: PERMISSIONS.CHAPTER_READ },
      { href: "/team/modules/redesign", label: "Module Redesign Studio", icon: "auto_fix_high", permission: PERMISSIONS.MODULE_READ },
      { href: "/team/modules", label: "Module Studio (PDF)", icon: "picture_as_pdf", permission: PERMISSIONS.MODULE_READ },
      { href: "/team/brand-profiles", label: "Brand Profiles", icon: "palette", permission: PERMISSIONS.MODULE_BRAND_PROFILE_MANAGE },
      { href: "/team/download-center", label: "Download Center", icon: "download_for_offline", permission: PERMISSIONS.TEAM_PORTAL_ACCESS },
    ],
  },
  {
    id: "assessment",
    title: "Assessment & Practice",
    icon: "quiz",
    description: "Tests, question bank, OCR extraction, QC, and exercise builder",
    items: [
      { href: "/team/tests", label: "Test Management", icon: "quiz", permission: PERMISSIONS.TEST_READ },
      { href: "/team/test-series", label: "Test Series", icon: "collections_bookmark", permission: PERMISSIONS.TEST_READ },
      { href: "/team/questions", label: "Question Bank", icon: "database", permission: PERMISSIONS.QUESTION_READ },
      { href: "/team/questions/atomic", label: "Atomic Question Bank", icon: "verified", permission: PERMISSIONS.QUESTION_READ },
      { href: "/team/qc", label: "Question QC & Verification", icon: "verified_user", permission: PERMISSIONS.QUESTION_VERIFY },
      { href: "/team/question-extract", label: "Question Extract (PDF OCR)", icon: "document_scanner", permission: PERMISSIONS.QUESTION_CREATE },
      { href: "/team/pyq-library", label: "PYQ Library", icon: "history_edu", permission: PERMISSIONS.QUESTION_READ },
      { href: "/team/pyq-library/import", label: "Import PYQ PDF", icon: "upload_file", permission: PERMISSIONS.QUESTION_IMPORT },
      { href: "/team/exercises", label: "Exercise Builder (Modules)", icon: "assignment", permission: PERMISSIONS.QUESTION_READ },
      { href: "/team/dpp", label: "Daily Practice Papers (DPP)", icon: "task_alt", permission: PERMISSIONS.DPP_READ },
      { href: "/team/questions/collections", label: "Question Collections", icon: "folder_special", permission: PERMISSIONS.QUESTION_READ },
      { href: "/team/questions/ai-generated", label: "AI Generated Questions", icon: "psychology", permission: PERMISSIONS.QUESTION_CREATE },
      { href: "/team/questions/reports", label: "Question Error Reports", icon: "flag", permission: PERMISSIONS.QUESTION_READ },
      { href: "/team/my-question-bank", label: "My Assigned Questions", icon: "assignment_turned_in", permission: PERMISSIONS.QUESTION_READ },
      { href: "/team/pyq-modules", label: "Question Modules (PYQ)", icon: "library_books", permission: PERMISSIONS.MODULE_READ },
    ],
  },
  {
    id: "support",
    title: "Student Support",
    icon: "live_help",
    description: "Doubt desk, 1:1 doubt booking, and academic resolution",
    items: [
      { href: "/team/doubts", label: "Doubt Desk", icon: "live_help", permission: PERMISSIONS.DOUBT_READ },
      { href: "/team/doubt-booking", label: "1:1 Doubt Session Booking", icon: "event_available", permission: PERMISSIONS.WHITEBOARD_ACCESS },
    ],
  },
  {
    id: "crm",
    title: "CRM & Admissions",
    icon: "person_search",
    description: "Lead pipeline, student admissions, follow-ups, and calling companion",
    items: [
      { href: "/team/leads", label: "CRM / Leads Pipeline", icon: "person_search", permission: PERMISSIONS.LEAD_READ },
      { href: "/team/apps", label: "Calling Companion APK", icon: "phone_in_talk", permission: PERMISSIONS.APP_RELEASE_MANAGE },
    ],
  },
  {
    id: "marketing",
    title: "Marketing & Comms",
    icon: "campaign",
    description: "Communication center, bulk notifications, WhatsApp, and coupons",
    items: [
      { href: "/team/communication", label: "Communication Center", icon: "forum", permission: PERMISSIONS.COMMUNICATION_CENTER_ACCESS },
      { href: "/team/notifications", label: "Bulk Notifications", icon: "campaign", permission: PERMISSIONS.NOTIFICATION_READ },
      { href: "/team/whatsapp", label: "WhatsApp Automation", icon: "chat", permission: PERMISSIONS.WHATSAPP_READ },
      { href: "/team/coupons", label: "Coupons & Discounts", icon: "confirmation_number", permission: PERMISSIONS.COUPON_READ },
      { href: "/team/creatives", label: "Creative Management", icon: "palette", permission: PERMISSIONS.COMMUNICATION_CENTER_ACCESS },
      { href: "/team/gamification/xp", label: "XP & Gamification", icon: "military_tech", permission: PERMISSIONS.GAMIFICATION_MANAGE },
    ],
  },
  {
    id: "finance",
    title: "Finance & Commerce",
    icon: "payments",
    description: "Invoices, transactions, refunds, and subscription plans",
    items: [
      { href: "/team/finance", label: "Finance & Invoices", icon: "payments", permission: PERMISSIONS.FINANCE_READ },
      { href: "/team/subscriptions", label: "Subscriptions & Pricing", icon: "workspace_premium", permission: PERMISSIONS.FINANCE_READ },
    ],
  },
  {
    id: "analytics",
    title: "Analytics & Reports",
    icon: "analytics",
    description: "Cross-portal analytics, attendance, and performance diagnostics",
    items: [
      { href: "/team/analytics", label: "Executive Analytics", icon: "analytics", permission: PERMISSIONS.ANALYTICS_VIEW },
      { href: "/team/performance", label: "Performance Boards", icon: "monitoring", permission: PERMISSIONS.TEAM_PORTAL_ACCESS, superAdminOnly: true },
      { href: "/team/live-diagnostics", label: "Live Diagnostics", icon: "monitor_heart", permission: PERMISSIONS.TEAM_PORTAL_ACCESS, superAdminOnly: true },
    ],
  },
  {
    id: "website-apps",
    title: "Website & Apps",
    icon: "web",
    description: "Public website CMS, app releases, banners, blogs, and testimonials",
    items: [
      { href: "/team/website", label: "Website Builder", icon: "web", permission: PERMISSIONS.TEAM_PORTAL_ACCESS, superAdminOnly: true },
      { href: "/team/apps", label: "App Releases (APK / EXE)", icon: "install_mobile", permission: PERMISSIONS.APP_RELEASE_MANAGE },
      { href: "/team/website/banners", label: "App & Web Banners", icon: "view_carousel", permission: PERMISSIONS.TEAM_PORTAL_ACCESS },
      { href: "/team/website/hero", label: "Homepage Hero Image", icon: "image", permission: PERMISSIONS.TEAM_PORTAL_ACCESS, superAdminOnly: true },
      { href: "/team/website/blog", label: "Blog Posts", icon: "article", permission: PERMISSIONS.TEAM_PORTAL_ACCESS, superAdminOnly: true },
      { href: "/team/website/testimonials", label: "Student Testimonials", icon: "rate_review", permission: PERMISSIONS.TEAM_PORTAL_ACCESS, superAdminOnly: true },
      { href: "/team/website/faqs", label: "FAQs Management", icon: "help_center", permission: PERMISSIONS.TEAM_PORTAL_ACCESS, superAdminOnly: true },
      { href: "/team/account-deletions", label: "Account Deletions", icon: "person_remove", permission: PERMISSIONS.TEAM_PORTAL_ACCESS, superAdminOnly: true },
    ],
  },
  {
    id: "administration",
    title: "System Administration",
    icon: "admin_panel_settings",
    description: "Security center, login devices, roles matrix, and audit compliance",
    items: [
      { href: "/team/security", label: "Security Center", icon: "security", permission: PERMISSIONS.SECURITY_CONFIG_MANAGE },
      { href: "/team/devices", label: "Login Devices", icon: "devices", permission: PERMISSIONS.SECURITY_DEVICE_MANAGE },
      { href: "/team/roles", label: "Roles & Permission Matrix", icon: "shield_lock", permission: PERMISSIONS.ROLE_MANAGE },
      { href: "/team/compliance", label: "Audit & Compliance", icon: "verified_user", permission: PERMISSIONS.PENALTY_READ_SELF },
    ],
  },
];

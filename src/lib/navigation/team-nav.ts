import { PERMISSIONS } from "@/lib/rbac/permissions";

export interface TeamNavItem {
  href: string;
  label: string;
  icon: string;
  permission: string;
  superAdminOnly?: boolean;
  description?: string;
}

export interface TeamNavGroup {
  title?: string;
  items: TeamNavItem[];
}

export const TEAM_NAV_CONFIG: TeamNavGroup[] = [
  {
    items: [
      { href: "/team", label: "Dashboard", icon: "space_dashboard", permission: PERMISSIONS.TEAM_PORTAL_ACCESS, description: "Main operations and overview dashboard" },
      { href: "/team/messages", label: "Messages & Inbox", icon: "forum", permission: PERMISSIONS.MESSAGE_READ, description: "Internal team communication & direct messages" },
      { href: "/", label: "Website Homepage", icon: "public", permission: PERMISSIONS.TEAM_PORTAL_ACCESS, description: "Public platform homepage" },
    ],
  },
  {
    title: "Teaching",
    items: [
      { href: "/team/my-schedule", label: "My Schedule", icon: "calendar_month", permission: PERMISSIONS.WHITEBOARD_ACCESS, description: "Faculty teaching schedule and timetable" },
      { href: "/team/doubt-booking", label: "Doubt Book Session", icon: "event_available", permission: PERMISSIONS.WHITEBOARD_ACCESS, description: "1-on-1 student doubt bookings and slots" },
      { href: "/team/batches", label: "Batches", icon: "groups", permission: PERMISSIONS.BATCH_READ, description: "Academic batches, courses & schedules" },
      { href: "/team/chapters", label: "Chapters", icon: "auto_stories", permission: PERMISSIONS.CHAPTER_READ, description: "Curriculum chapters and lecture plans" },
      { href: "/team/recorded-lectures", label: "Recorded Lectures", icon: "video_library", permission: PERMISSIONS.LECTURE_READ, superAdminOnly: true, description: "Video archive and lecture recordings" },
      { href: "/team/study-material", label: "Study Material", icon: "folder_open", permission: PERMISSIONS.STUDY_MATERIAL_MANAGE, description: "Formula sheets, mind maps, and chapter notes" },
      { href: "/team/tests", label: "Tests", icon: "quiz", permission: PERMISSIONS.TEST_READ, description: "Mock tests, blueprints and exams" },
      { href: "/team/test-series", label: "Test Series", icon: "collections_bookmark", permission: PERMISSIONS.TEST_READ, description: "Structured test series packages" },
      { href: "/team/exercises", label: "Exercise Builder (Modules)", icon: "assignment", permission: PERMISSIONS.QUESTION_READ, description: "Chapter exercises and question assignments" },
      { href: "/team/whiteboard", label: "Whiteboard", icon: "draw", permission: PERMISSIONS.WHITEBOARD_ACCESS, description: "Interactive teaching whiteboard session" },
      { href: "/team/dpp", label: "DPP", icon: "task_alt", permission: PERMISSIONS.DPP_READ, description: "Daily practice problem sheets" },
      { href: "/team/ncert", label: "NCERT Practice Hub", icon: "menu_book", permission: PERMISSIONS.CHAPTER_READ, description: "NCERT line-by-line questions and analysis" },
      { href: "/team/board-exam", label: "Board Exam Hub", icon: "school", permission: PERMISSIONS.CHAPTER_READ, description: "CBSE & State Board exam repository" },
      { href: "/team/download-center", label: "Download Center", icon: "download_for_offline", permission: PERMISSIONS.TEAM_PORTAL_ACCESS, description: "Downloadable documents, keys, and sheets" },
      { href: "/team/doubts", label: "Doubt Desk", icon: "live_help", permission: PERMISSIONS.DOUBT_READ, description: "Student doubt tickets and handwritten solutions" },
    ],
  },
  {
    title: "Question Bank",
    items: [
      { href: "/team/questions", label: "Question Bank", icon: "database", permission: PERMISSIONS.QUESTION_READ, description: "Question bank repository and search" },
      { href: "/team/questions/atomic", label: "Atomic Question Bank", icon: "verified", permission: PERMISSIONS.QUESTION_READ, description: "Verified Atomic Pathshala questions" },
      { href: "/team/exercises", label: "Exercise Builder", icon: "assignment", permission: PERMISSIONS.QUESTION_READ, description: "Curate module exercise sets" },
      { href: "/team/my-question-bank", label: "My Assigned Questions", icon: "assignment_turned_in", permission: PERMISSIONS.QUESTION_READ, description: "Questions assigned to this user for review" },
      { href: "/team/questions/reports", label: "Question Reports", icon: "flag", permission: PERMISSIONS.QUESTION_READ, description: "Quality audit reports and flagged questions" },
      { href: "/team/qc", label: "Question QC", icon: "verified_user", permission: PERMISSIONS.QUESTION_VERIFY, description: "Quality control and bilingual verification" },
      { href: "/team/questions/collections", label: "Question Collections", icon: "folder_special", permission: PERMISSIONS.QUESTION_READ, description: "Grouped question sets" },
      { href: "/team/questions/ai-generated", label: "AI Generated Questions", icon: "psychology", permission: PERMISSIONS.QUESTION_CREATE, description: "Generative AI question authoring" },
      { href: "/team/question-extract", label: "Question Extract", icon: "document_scanner", permission: PERMISSIONS.QUESTION_CREATE, description: "OCR and PDF extraction pipeline" },
      { href: "/team/pyq-library", label: "PYQ Library", icon: "history_edu", permission: PERMISSIONS.QUESTION_READ, description: "Previous Year Questions for NEET & JEE" },
      { href: "/team/pyq-library/import", label: "Import PYQ PDF", icon: "upload_file", permission: PERMISSIONS.QUESTION_IMPORT, description: "Bulk PDF import for PYQ papers" },
    ],
  },
  {
    title: "Website & App CMS",
    items: [
      { href: "/team/seo", label: "SEO Manager", icon: "troubleshoot", permission: PERMISSIONS.SEO_MANAGE, superAdminOnly: true, description: "Search engine optimization, faculty SEO, keywords, audit & visibility engine" },
      { href: "/team/website/media", label: "Media Library", icon: "photo_library", permission: PERMISSIONS.MEDIA_VIEW, description: "Media assets, brand graphics, and videos" },
      { href: "/team/website/banners", label: "App & Web Banners", icon: "view_carousel", permission: PERMISSIONS.TEAM_PORTAL_ACCESS, description: "Promotional hero banners and carousel" },
      { href: "/team/website/hero", label: "Homepage Hero Image", icon: "image", permission: PERMISSIONS.TEAM_PORTAL_ACCESS, superAdminOnly: true, description: "Main landing hero configuration" },
      { href: "/team/website/blog", label: "Blog", icon: "article", permission: PERMISSIONS.TEAM_PORTAL_ACCESS, superAdminOnly: true, description: "Educational blog posts and news" },
      { href: "/team/website/testimonials", label: "Student Feedback / Reviews", icon: "rate_review", permission: PERMISSIONS.TEAM_PORTAL_ACCESS, superAdminOnly: true, description: "Approved student feedback and reviews" },
      { href: "/team/website/faqs", label: "FAQs (फेक प्रश्न/उत्तर)", icon: "help_center", permission: PERMISSIONS.TEAM_PORTAL_ACCESS, superAdminOnly: true, description: "Platform frequently asked questions" },
      { href: "/team/website", label: "Website Builder", icon: "web", permission: PERMISSIONS.TEAM_PORTAL_ACCESS, superAdminOnly: true, description: "Live website page composer" },
      { href: "/team/apps", label: "App Releases (Windows / Android)", icon: "install_mobile", permission: PERMISSIONS.APP_RELEASE_MANAGE, description: "App installation binaries and OTA versions" },
      { href: "/team/account-deletions", label: "Account Deletions", icon: "person_remove", permission: PERMISSIONS.TEAM_PORTAL_ACCESS, superAdminOnly: true, description: "Student account erasure compliance" },
    ],
  },
  {
    title: "Content Studio",
    items: [
      { href: "/team/modules/redesign", label: "Module Redesign Studio", icon: "auto_fix_high", permission: PERMISSIONS.MODULE_READ, description: "Visual module cover and typography studio" },
      { href: "/team/modules", label: "Module Studio", icon: "picture_as_pdf", permission: PERMISSIONS.MODULE_READ, description: "Printed booklets and printable modules" },
      { href: "/team/pyq-modules", label: "Question Modules (PYQ)", icon: "library_books", permission: PERMISSIONS.MODULE_READ, description: "Subject PYQ book modules" },
      { href: "/team/brand-profiles", label: "Brand Profiles", icon: "palette", permission: PERMISSIONS.MODULE_BRAND_PROFILE_MANAGE, description: "Typography and branding profiles" },
    ],
  },
  {
    title: "Administration & People",
    items: [
      { href: "/team/role-preview", label: "View As / Role Preview", icon: "visibility", permission: PERMISSIONS.ROLE_MANAGE, superAdminOnly: true, description: "Simulate and inspect any employee or role portal experience" },
      { href: "/team/students", label: "Student Management", icon: "school", permission: PERMISSIONS.STUDENT_READ_ANY, description: "Student accounts, enrollments and academic records" },
      { href: "/team/users", label: "Team & Staff Management", icon: "badge", permission: PERMISSIONS.USER_READ, description: "Staff directories, user accounts, and credentials" },
      { href: "/team/id-cards", label: "ID Cards", icon: "id_card", permission: PERMISSIONS.USER_STATUS_MANAGE, description: "Staff ID card generation and dispatch" },
      { href: "/team/invitations", label: "Staff Invitations", icon: "mail", permission: PERMISSIONS.STAFF_INVITE, description: "Staff invitation and onboarding links" },
      { href: "/team/roles", label: "Roles & Permissions", icon: "security", permission: PERMISSIONS.ROLE_MANAGE, description: "RBAC matrix and custom role builder" },
      { href: "/team/devices", label: "Login Devices", icon: "devices", permission: PERMISSIONS.SECURITY_DEVICE_MANAGE, description: "Active session devices and remote logout" },
      { href: "/team/departments", label: "Departments & Positions", icon: "corporate_fare", permission: PERMISSIONS.DEPARTMENT_MANAGE, description: "Organizational hierarchy" },
      { href: "/team/communication", label: "Communication Center", icon: "forum", permission: PERMISSIONS.COMMUNICATION_CENTER_ACCESS, description: "Broadcast emails, templates and campaigns" },
      { href: "/team/creatives", label: "Creative Management", icon: "palette", permission: PERMISSIONS.COMMUNICATION_CENTER_ACCESS, description: "Marketing banners and creative assets" },
    ],
  },
  {
    title: "People",
    items: [
      { href: "/team/faculty", label: "Faculty", icon: "school", permission: PERMISSIONS.FACULTY_DIRECTORY, description: "Teacher profiles, bios and watch times" },
      { href: "/team/employees", label: "Employee ID Verification", icon: "badge", permission: PERMISSIONS.FACULTY_DIRECTORY, description: "Employee ID documents and verification" },
      { href: "/team/contracts", label: "Contracts & Agreements", icon: "description", permission: PERMISSIONS.CONTRACT_READ_ANY, description: "Staff agreements and digital signatures" },
      { href: "/team/onboarding", label: "Onboarding", icon: "pending_actions", permission: PERMISSIONS.ONBOARDING_REVIEW, description: "New recruit profile reviews" },
      { href: "/team/leaderboard", label: "Leaderboard", icon: "leaderboard", permission: PERMISSIONS.LEADERBOARD_READ, description: "Educator performance leaderboard" },
    ],
  },
  {
    title: "Gamification",
    items: [
      { href: "/team/gamification/xp", label: "XP Management", icon: "military_tech", permission: PERMISSIONS.GAMIFICATION_MANAGE, description: "Student gamification points and XP rules" },
    ],
  },
  {
    title: "Growth",
    items: [
      { href: "/team/leads", label: "CRM / Leads", icon: "person_search", permission: PERMISSIONS.LEAD_READ, description: "Student leads, pipeline, and follow-ups" },
      { href: "/team/whatsapp", label: "WhatsApp Automation", icon: "chat", permission: PERMISSIONS.WHATSAPP_READ, description: "WhatsApp campaigns and automation" },
      { href: "/team/coupons", label: "Coupons", icon: "confirmation_number", permission: PERMISSIONS.COUPON_READ, description: "Discount coupon codes and campaigns" },
      { href: "/team/notifications", label: "Notifications", icon: "campaign", permission: PERMISSIONS.NOTIFICATION_READ, description: "Push notifications and announcements" },
    ],
  },
  {
    title: "Finance & Insights",
    items: [
      { href: "/team/finance", label: "Finance", icon: "payments", permission: PERMISSIONS.FINANCE_READ, description: "Revenue reports, refunds, and transactions" },
      { href: "/team/subscriptions", label: "Subscriptions", icon: "workspace_premium", permission: PERMISSIONS.FINANCE_READ, description: "Manual subscription grants and renewals" },
      { href: "/team/analytics", label: "Analytics", icon: "analytics", permission: PERMISSIONS.ANALYTICS_VIEW, description: "Platform-wide engagement analytics" },
      { href: "/team/performance", label: "Performance Boards", icon: "monitoring", permission: PERMISSIONS.TEAM_PORTAL_ACCESS, superAdminOnly: true, description: "Executive KPI board" },
      { href: "/team/live-diagnostics", label: "Live Class Diagnostics", icon: "monitor_heart", permission: PERMISSIONS.TEAM_PORTAL_ACCESS, superAdminOnly: true, description: "WebRTC and live class stream health" },
      { href: "/team/security", label: "Security Center", icon: "security", permission: PERMISSIONS.SECURITY_CONFIG_MANAGE, description: "Security audits and rate limit settings" },
      { href: "/team/predictor", label: "Rank/College Predictor", icon: "insights", permission: PERMISSIONS.PREDICTOR_DATA_MANAGE, description: "NEET/JEE college predictor cutoff datasets" },
    ],
  },
  {
    title: "My Account",
    items: [
      { href: "/team/id-card", label: "My ID Card", icon: "id_card", permission: PERMISSIONS.TEAM_PORTAL_ACCESS, description: "Employee digital identification badge" },
      { href: "/team/documents", label: "My Documents", icon: "badge", permission: PERMISSIONS.DOCUMENT_UPLOAD_SELF, description: "KYC documents and contracts" },
      { href: "/team/compliance", label: "Compliance", icon: "gavel", permission: PERMISSIONS.PENALTY_READ_SELF, description: "Compliance rules and records" },
    ],
  },
];

import { PERMISSIONS } from "@/lib/rbac/permissions";

export interface TeamNavSubItem {
  href: string;
  label: string;
  icon: string; // Lucide icon identifier
  permission: string;
  superAdminOnly?: boolean;
  badge?: string;
}

export interface TeamNavGroup {
  id: string;
  title: string;
  items: TeamNavSubItem[];
}

export const ATOMIC_OPS_NAV_GROUPS: TeamNavGroup[] = [
  {
    id: "workspace",
    title: "WORKSPACE",
    items: [
      { href: "/team", label: "Overview", icon: "LayoutDashboard", permission: PERMISSIONS.TEAM_PORTAL_ACCESS },
      { href: "/team/messages", label: "Messages & Inbox", icon: "MessageSquare", permission: PERMISSIONS.MESSAGE_READ },
    ],
  },
  {
    id: "academics",
    title: "ACADEMICS",
    items: [
      { href: "/team/chapters", label: "Academic Management", icon: "GraduationCap", permission: PERMISSIONS.CHAPTER_READ },
      { href: "/team/batches", label: "Batches & Courses", icon: "Layers", permission: PERMISSIONS.BATCH_READ },
      { href: "/team/my-schedule", label: "Timetable & Schedules", icon: "Calendar", permission: PERMISSIONS.WHITEBOARD_ACCESS },
      { href: "/team/live-diagnostics", label: "Attendance & Diagnostics", icon: "UserCheck", permission: PERMISSIONS.TEAM_PORTAL_ACCESS, superAdminOnly: true },
      { href: "/team/faculty", label: "Faculty Directory", icon: "Users", permission: PERMISSIONS.FACULTY_DIRECTORY },
    ],
  },
  {
    id: "learning",
    title: "LEARNING",
    items: [
      { href: "/team/live-studio", label: "Live Classroom (Studio)", icon: "Video", permission: PERMISSIONS.WHITEBOARD_ACCESS },
      { href: "/team/recorded-lectures", label: "Lecture Management", icon: "PlaySquare", permission: PERMISSIONS.LECTURE_READ, superAdminOnly: true },
      { href: "/team/modules", label: "Content Library (Modules)", icon: "FolderKanban", permission: PERMISSIONS.MODULE_READ },
      { href: "/team/study-material", label: "Study Materials", icon: "FileText", permission: PERMISSIONS.STUDY_MATERIAL_MANAGE },
      { href: "/team/ncert", label: "NCERT Hub", icon: "BookOpen", permission: PERMISSIONS.CHAPTER_READ },
      { href: "/team/board-exam", label: "Board Exam Hub", icon: "Award", permission: PERMISSIONS.CHAPTER_READ },
    ],
  },
  {
    id: "assessment",
    title: "ASSESSMENT",
    items: [
      { href: "/team/tests", label: "Test Management", icon: "FileCheck2", permission: PERMISSIONS.TEST_READ },
      { href: "/team/test-series", label: "Test Series", icon: "Library", permission: PERMISSIONS.TEST_READ },
      { href: "/team/questions", label: "Question Bank", icon: "Database", permission: PERMISSIONS.QUESTION_READ },
      { href: "/team/qc", label: "Question Verification (QC)", icon: "ShieldCheck", permission: PERMISSIONS.QUESTION_VERIFY },
      { href: "/team/question-extract", label: "Question Extract (OCR)", icon: "ScanText", permission: PERMISSIONS.QUESTION_CREATE },
      { href: "/team/exercises", label: "Exercise Builder", icon: "BookOpen", permission: PERMISSIONS.QUESTION_READ },
      { href: "/team/dpp", label: "DPP Management", icon: "CheckSquare", permission: PERMISSIONS.DPP_READ },
      { href: "/team/performance", label: "Results & Performance", icon: "TrendingUp", permission: PERMISSIONS.TEAM_PORTAL_ACCESS, superAdminOnly: true },
    ],
  },
  {
    id: "students",
    title: "STUDENTS",
    items: [
      { href: "/team/students", label: "Student Directory", icon: "Users", permission: PERMISSIONS.STUDENT_READ_ANY },
      { href: "/team/leads", label: "Admissions & Leads", icon: "Contact2", permission: PERMISSIONS.LEAD_READ },
      { href: "/team/subscriptions", label: "Course Access & Plans", icon: "KeyRound", permission: PERMISSIONS.FINANCE_READ },
      { href: "/team/doubts", label: "Doubt Desk", icon: "HelpCircle", permission: PERMISSIONS.DOUBT_READ },
      { href: "/team/doubt-booking", label: "1:1 Doubt Booking", icon: "CalendarClock", permission: PERMISSIONS.WHITEBOARD_ACCESS },
    ],
  },
  {
    id: "organization",
    title: "ORGANIZATION",
    items: [
      { href: "/team/users", label: "Team & Staff", icon: "BadgeCheck", permission: PERMISSIONS.USER_READ },
      { href: "/team/departments", label: "Departments", icon: "Building2", permission: PERMISSIONS.DEPARTMENT_MANAGE },
      { href: "/team/roles", label: "Roles & Permissions", icon: "Shield", permission: PERMISSIONS.ROLE_MANAGE },
      { href: "/team/id-cards", label: "ID Cards & Documents", icon: "CreditCard", permission: PERMISSIONS.USER_STATUS_MANAGE },
      { href: "/team/employees", label: "Employee Verification", icon: "FileCheck", permission: PERMISSIONS.FACULTY_DIRECTORY },
      { href: "/team/onboarding", label: "Staff Onboarding", icon: "UserPlus", permission: PERMISSIONS.ONBOARDING_REVIEW },
      { href: "/team/contracts", label: "Contracts & Agreements", icon: "FileText", permission: PERMISSIONS.CONTRACT_READ_ANY },
    ],
  },
  {
    id: "business",
    title: "BUSINESS",
    items: [
      { href: "/team/finance", label: "Finance & Invoices", icon: "Wallet", permission: PERMISSIONS.FINANCE_READ },
      { href: "/team/coupons", label: "Coupons & Discounts", icon: "Ticket", permission: PERMISSIONS.COUPON_READ },
      { href: "/team/notifications", label: "Marketing Broadcasts", icon: "Megaphone", permission: PERMISSIONS.NOTIFICATION_READ },
      { href: "/team/communication", label: "Communication Center", icon: "MessageSquare", permission: PERMISSIONS.COMMUNICATION_CENTER_ACCESS },
      { href: "/team/creatives", label: "Brand Creatives", icon: "Palette", permission: PERMISSIONS.COMMUNICATION_CENTER_ACCESS },
    ],
  },
  {
    id: "insights",
    title: "INSIGHTS",
    items: [
      { href: "/team/analytics", label: "Executive Analytics", icon: "BarChart3", permission: PERMISSIONS.ANALYTICS_VIEW },
      { href: "/team/questions/reports", label: "Quality & Error Reports", icon: "FileSpreadsheet", permission: PERMISSIONS.QUESTION_READ },
      { href: "/team/leaderboard", label: "Academic Leaderboard", icon: "Award", permission: PERMISSIONS.LEADERBOARD_READ },
    ],
  },
  {
    id: "system",
    title: "SYSTEM",
    items: [
      { href: "/team/website", label: "Website Builder", icon: "Globe", permission: PERMISSIONS.TEAM_PORTAL_ACCESS, superAdminOnly: true },
      { href: "/team/apps", label: "Applications (APK/EXE)", icon: "Smartphone", permission: PERMISSIONS.APP_RELEASE_MANAGE },
      { href: "/team/whatsapp", label: "Integrations (WhatsApp)", icon: "Share2", permission: PERMISSIONS.WHATSAPP_READ },
      { href: "/team/security", label: "System Security & Devices", icon: "Settings", permission: PERMISSIONS.SECURITY_CONFIG_MANAGE },
      { href: "/team/compliance", label: "Audit & Compliance", icon: "ShieldAlert", permission: PERMISSIONS.PENALTY_READ_SELF },
    ],
  },
];

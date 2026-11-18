import "server-only";
import { prisma } from "@/lib/db";
import {
  PERMISSIONS,
  ROLE_PERMISSION_DEFAULTS,
  type PermissionCode,
  parseGlobalRole,
} from "@/lib/rbac/permissions";
import { PERMISSION_GROUPS } from "@/lib/rbac/permission-groups";
import { TEAM_NAV_CONFIG, type TeamNavGroup, type TeamNavItem } from "@/lib/navigation/team-nav";

export type PermissionSourceType =
  | "ROLE_DEFAULT"
  | "ROLE_DATABASE"
  | "USER_OVERRIDE_GRANTED"
  | "USER_OVERRIDE_DENIED"
  | "SUPER_ADMIN_BYPASS"
  | "NOT_GRANTED"
  | "ACCOUNT_INACTIVE";

export interface PermissionEvaluationDetail {
  code: string;
  granted: boolean;
  source: PermissionSourceType;
  sourceLabel: string;
  reason: string;
  details?: string;
}

export interface SimulatedSidebarItem extends TeamNavItem {
  status: "VISIBLE" | "HIDDEN" | "RESTRICTED";
  state: "VISIBLE" | "HIDDEN" | "RESTRICTED";
  reason: string;
  requiredPermission: string;
  requiredPermissions?: string[];
}

export interface SimulatedSidebarGroup {
  title?: string;
  items: SimulatedSidebarItem[];
}

export interface SidebarEvaluationResult {
  groups: SimulatedSidebarGroup[];
  items: SimulatedSidebarItem[];
  visibleCount: number;
  totalCount: number;
}

export interface ModuleActionItem {
  id: string;
  module: string;
  label: string;
  icon?: string;
  permissionCode: string;
  description: string;
  isDestructive?: boolean;
}

export interface SimulatedButtonAction extends ModuleActionItem {
  allowed: boolean;
  uiState: "VISIBLE" | "HIDDEN" | "DISABLED_READONLY";
  state: "VISIBLE" | "HIDDEN" | "DISABLED_READONLY";
  requiredPermission: string;
  source: PermissionSourceType;
  reason: string;
}

export interface ModulePermissionSummary {
  module: string;
  moduleLabel: string;
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
  publish: boolean;
  export: boolean;
  manage: boolean;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canPublish: boolean;
  canExport: boolean;
  canManage: boolean;
  actions: { code: string; label: string; granted: boolean }[];
}

export interface SimulationTargetInfo {
  type: "EMPLOYEE" | "ROLE";
  id: string;
  name: string;
  email?: string;
  code: string;
  department: string;
  position: string;
  roleName: string;
  roleLabel: string;
  status: string;
  overridesCount: number;
  subjectScope: string[];
  batchScope: string[];
  contractEnd?: string | null;
}

export interface SimulationResult {
  simulatedTarget: SimulationTargetInfo;
  targetUser: SimulationTargetInfo;
  totalGrantedCount: number;
  effectivePermissions: string[];
  permissionEvaluations: Record<string, PermissionEvaluationDetail>;
  detailedPermissions: (PermissionEvaluationDetail & { details: string })[];
  sidebarEvaluation: SidebarEvaluationResult;
  moduleMatrix: ModulePermissionSummary[];
  buttonActions: Record<string, SimulatedButtonAction[]>;
  pageActions: SimulatedButtonAction[];
  dataScope: {
    subjectScope: string[];
    batchScope: string[];
    studentPiiAccessible: boolean;
    studentPiiRestricted: boolean;
    financialDataAccessible: boolean;
    financeRestricted: boolean;
    summary: string;
  };
}

export interface ComparisonResult {
  sharedPermissions: string[];
  exclusiveTo1: string[];
  exclusiveTo2: string[];
  sharedCount: number;
  exclusiveTo1Count: number;
  exclusiveTo2Count: number;
  both: string[];
  only1: string[];
  only2: string[];
  bothCount: number;
  only1Count: number;
  only2Count: number;
  sidebarDifferences: {
    href: string;
    label: string;
    target1State: string;
    target2State: string;
    status1: string;
    status2: string;
    isDifferent: boolean;
  }[];
}

export const PAGE_ACTIONS_CATALOGUE: Record<string, ModuleActionItem[]> = {
  "/team": [
    { id: "dash_view", module: "Dashboard", label: "View KPI Dashboard", permissionCode: PERMISSIONS.TEAM_PORTAL_ACCESS, description: "View daily platform stats and active counters" },
    { id: "dash_switch_student", module: "Dashboard", label: "Switch to Student View", permissionCode: PERMISSIONS.STUDENT_VIEW_AS, description: "Preview portal in student mode" },
  ],
  "/team/batches": [
    { id: "batch_view", module: "Batches", label: "View Batches List", permissionCode: PERMISSIONS.BATCH_READ, description: "View scheduled academic batches" },
    { id: "batch_create", module: "Batches", label: "Create Batch", permissionCode: PERMISSIONS.BATCH_CREATE, description: "Add a new batch or academic course", isDestructive: false },
    { id: "batch_edit", module: "Batches", label: "Edit Batch Roadmap", permissionCode: PERMISSIONS.BATCH_UPDATE, description: "Modify roadmap, subjects and faculties" },
    { id: "batch_delete", module: "Batches", label: "Delete Batch", permissionCode: PERMISSIONS.BATCH_DELETE, description: "Permanently delete an academic batch", isDestructive: true },
    { id: "batch_enroll", module: "Batches", label: "Manage Enrollments", permissionCode: PERMISSIONS.BATCH_ENROLLMENT_MANAGE, description: "Enroll or unenroll students" },
    { id: "batch_sched", module: "Batches", label: "Edit Timetable", permissionCode: PERMISSIONS.BATCH_SCHEDULE_MANAGE, description: "Configure weekly live class timetable" },
  ],
  "/team/chapters": [
    { id: "ch_view", module: "Chapters", label: "View Chapters", permissionCode: PERMISSIONS.CHAPTER_READ, description: "View curriculum chapters list" },
    { id: "ch_create", module: "Chapters", label: "Add Chapter", permissionCode: PERMISSIONS.CHAPTER_CREATE, description: "Create chapter syllabus item" },
    { id: "ch_edit", module: "Chapters", label: "Edit Chapter Content", permissionCode: PERMISSIONS.CHAPTER_UPDATE, description: "Update chapter lectures and study materials" },
    { id: "ch_publish", module: "Chapters", label: "Publish Chapter", permissionCode: PERMISSIONS.CHAPTER_PUBLISH, description: "Make chapter live to students" },
    { id: "ch_review", module: "Chapters", label: "Review & Approve Chapter", permissionCode: PERMISSIONS.CHAPTER_REVIEW, description: "Approve draft chapters submitted by teachers" },
    { id: "ch_delete", module: "Chapters", label: "Delete Chapter", permissionCode: PERMISSIONS.CHAPTER_DELETE, description: "Remove chapter from curriculum", isDestructive: true },
  ],
  "/team/questions": [
    { id: "q_view", module: "Question Bank", label: "Search & View Questions", permissionCode: PERMISSIONS.QUESTION_READ, description: "Browse question bank and view solutions" },
    { id: "q_create", module: "Question Bank", label: "Add Question", permissionCode: PERMISSIONS.QUESTION_CREATE, description: "Author single question or bilingual version" },
    { id: "q_edit", module: "Question Bank", label: "Edit Question", permissionCode: PERMISSIONS.QUESTION_UPDATE, description: "Modify statement, options, or solution" },
    { id: "q_delete", module: "Question Bank", label: "Delete Question", permissionCode: PERMISSIONS.QUESTION_DELETE, description: "Delete question record", isDestructive: true },
    { id: "q_verify", module: "Question Bank", label: "Verify Question (QC)", permissionCode: PERMISSIONS.QUESTION_VERIFY, description: "Verify diagrams, answer keys and translations" },
    { id: "q_approve", module: "Question Bank", label: "Approve Question", permissionCode: PERMISSIONS.QUESTION_APPROVE, description: "Approve question for mock tests" },
    { id: "q_assign", module: "Question Bank", label: "Assign Reviewer", permissionCode: PERMISSIONS.QUESTION_ASSIGN, description: "Assign question review to team members" },
    { id: "q_import", module: "Question Bank", label: "Bulk Import Questions", permissionCode: PERMISSIONS.QUESTION_IMPORT, description: "Import questions from PDF or JSON" },
    { id: "q_export", module: "Question Bank", label: "Export Questions", permissionCode: PERMISSIONS.QUESTION_EXPORT, description: "Export questions to LaTeX/PDF format" },
  ],
  "/team/tests": [
    { id: "test_view", module: "Test Engine", label: "View Tests", permissionCode: PERMISSIONS.TEST_READ, description: "Browse mock tests and student results" },
    { id: "test_create", module: "Test Engine", label: "Create Test", permissionCode: PERMISSIONS.TEST_CREATE, description: "Author new test or blueprint" },
    { id: "test_edit", module: "Test Engine", label: "Edit Test Blueprint", permissionCode: PERMISSIONS.TEST_UPDATE, description: "Modify sections, timings and marking scheme" },
    { id: "test_publish", module: "Test Engine", label: "Publish Test Live", permissionCode: PERMISSIONS.TEST_PUBLISH, description: "Make test available to students" },
    { id: "test_approve", module: "Test Engine", label: "Approve Test", permissionCode: PERMISSIONS.TEST_APPROVE, description: "Approve test for scheduled release" },
    { id: "test_delete", module: "Test Engine", label: "Delete Test", permissionCode: PERMISSIONS.TEST_DELETE, description: "Permanently delete test and scores", isDestructive: true },
  ],
  "/team/dpp": [
    { id: "dpp_view", module: "DPP", label: "View DPP Sheets", permissionCode: PERMISSIONS.DPP_READ, description: "View daily practice problem sets" },
    { id: "dpp_create", module: "DPP", label: "Create DPP", permissionCode: PERMISSIONS.DPP_CREATE, description: "Assemble DPP sheet for lecture" },
    { id: "dpp_edit", module: "DPP", label: "Edit DPP", permissionCode: PERMISSIONS.DPP_UPDATE, description: "Modify questions or solutions" },
    { id: "dpp_publish", module: "DPP", label: "Publish DPP", permissionCode: PERMISSIONS.DPP_PUBLISH, description: "Release DPP to batch students" },
    { id: "dpp_delete", module: "DPP", label: "Delete DPP", permissionCode: PERMISSIONS.DPP_DELETE, description: "Remove DPP sheet", isDestructive: true },
  ],
  "/team/website/media": [
    { id: "media_view", module: "Media Management", label: "Browse Media Assets", permissionCode: PERMISSIONS.MEDIA_VIEW, description: "View photos, icons, and videos" },
    { id: "media_upload", module: "Media Management", label: "Upload Media File", permissionCode: PERMISSIONS.MEDIA_UPLOAD, description: "Upload raw image or video to storage" },
    { id: "media_edit", module: "Media Management", label: "Edit Media Details", permissionCode: PERMISSIONS.MEDIA_EDIT, description: "Rename or recategorize media assets" },
    { id: "media_delete", module: "Media Management", label: "Delete Media Asset", permissionCode: PERMISSIONS.MEDIA_DELETE, description: "Delete asset from media storage", isDestructive: true },
    { id: "media_thumb", module: "Media Management", label: "Manage Thumbnails", permissionCode: PERMISSIONS.MEDIA_THUMBNAIL_MANAGE, description: "Generate or upload custom video thumbnails" },
    { id: "media_brand", module: "Media Management", label: "Manage Brand Assets", permissionCode: PERMISSIONS.MEDIA_ASSETS_MANAGE, description: "Update logos and watermark assets" },
  ],
  "/team/creatives": [
    { id: "mkt_view", module: "Marketing & Promotions", label: "View Campaigns", permissionCode: PERMISSIONS.MARKETING_CAMPAIGN_VIEW, description: "View marketing campaigns and creatives" },
    { id: "mkt_create", module: "Marketing & Promotions", label: "Create Campaign", permissionCode: PERMISSIONS.MARKETING_CAMPAIGN_CREATE, description: "Launch new promotional campaign" },
    { id: "mkt_edit", module: "Marketing & Promotions", label: "Edit Campaign", permissionCode: PERMISSIONS.MARKETING_CAMPAIGN_EDIT, description: "Modify campaign creatives and copies" },
    { id: "mkt_creative", module: "Marketing & Promotions", label: "Manage Creatives", permissionCode: PERMISSIONS.MARKETING_CREATIVE_MANAGE, description: "Upload banner creatives and graphics" },
    { id: "mkt_analytics", module: "Marketing & Promotions", label: "Campaign Analytics", permissionCode: PERMISSIONS.MARKETING_CAMPAIGN_ANALYTICS, description: "Inspect conversion rates and reach" },
  ],
  "/team/communication": [
    { id: "comm_access", module: "Communication Center", label: "Access Center", permissionCode: PERMISSIONS.COMMUNICATION_CENTER_ACCESS, description: "Open broadcast communication portal" },
    { id: "comm_draft_create", module: "Communication Center", label: "Create Draft Message", permissionCode: PERMISSIONS.COMMUNICATION_DRAFT_CREATE, description: "Draft announcement or email campaign" },
    { id: "comm_draft_edit", module: "Communication Center", label: "Edit Draft Message", permissionCode: PERMISSIONS.COMMUNICATION_DRAFT_EDIT, description: "Modify drafted messages" },
    { id: "comm_submit", module: "Communication Center", label: "Submit for Admin Approval", permissionCode: PERMISSIONS.COMMUNICATION_APPROVAL_SUBMIT, description: "Send draft to Super Admin for broadcast approval" },
    { id: "comm_send_bulk", module: "Communication Center", label: "Send Bulk Broadcast", permissionCode: PERMISSIONS.NOTIFICATION_SEND, description: "Broadcast notification to all active students", isDestructive: true },
    { id: "comm_whatsapp", module: "Communication Center", label: "Send WhatsApp Campaign", permissionCode: PERMISSIONS.WHATSAPP_CAMPAIGN_MANAGE, description: "Execute bulk WhatsApp broadcast", isDestructive: true },
  ],
  "/team/finance": [
    { id: "fin_view", module: "Finance & Accounts", label: "View Revenue & Ledger", permissionCode: PERMISSIONS.FINANCE_READ, description: "Access student payment ledger and reports" },
    { id: "fin_refund", module: "Finance & Accounts", label: "Approve Refunds", permissionCode: PERMISSIONS.FINANCE_REFUND_APPROVE, description: "Authorize bank refunds", isDestructive: true },
    { id: "fin_invoice", module: "Finance & Accounts", label: "Generate Tax Invoices", permissionCode: PERMISSIONS.FINANCE_INVOICE_CREATE, description: "Create GST compliant receipts" },
    { id: "fin_sub_manage", module: "Finance & Accounts", label: "Manual Subscription Grant", permissionCode: PERMISSIONS.SUBSCRIPTION_MANAGE, description: "Grant or revoke course subscriptions", isDestructive: true },
  ],
  "/team/students": [
    { id: "stu_view_any", module: "Student Directory", label: "View All Students", permissionCode: PERMISSIONS.STUDENT_READ_ANY, description: "Browse all student contact numbers and profiles" },
    { id: "stu_create", module: "Student Directory", label: "Add Student Account", permissionCode: PERMISSIONS.STUDENT_CREATE, description: "Create student record directly" },
    { id: "stu_edit", module: "Student Directory", label: "Update Student Profile", permissionCode: PERMISSIONS.STUDENT_UPDATE, description: "Edit contact info or class" },
    { id: "stu_delete", module: "Student Directory", label: "Delete Student Account", permissionCode: PERMISSIONS.STUDENT_DELETE, description: "Erase student account", isDestructive: true },
  ],
  "/team/users": [
    { id: "user_view", module: "Staff Administration", label: "View Staff List", permissionCode: PERMISSIONS.USER_READ, description: "View employee profiles and positions" },
    { id: "user_create", module: "Staff Administration", label: "Create Staff User", permissionCode: PERMISSIONS.USER_CREATE, description: "Add new team member" },
    { id: "user_edit", module: "Staff Administration", label: "Edit Staff Profile", permissionCode: PERMISSIONS.USER_UPDATE, description: "Change department, contract, or position" },
    { id: "user_role_assign", module: "Staff Administration", label: "Assign Role to User", permissionCode: PERMISSIONS.USER_ROLE_ASSIGN, description: "Change user role", isDestructive: true },
    { id: "user_override", module: "Staff Administration", label: "Override User Permissions", permissionCode: PERMISSIONS.USER_PERMISSION_OVERRIDE, description: "Grant or deny individual permissions", isDestructive: true },
    { id: "user_delete", module: "Staff Administration", label: "Delete Staff Account", permissionCode: PERMISSIONS.USER_DELETE, description: "Permanently delete staff user", isDestructive: true },
  ],
  "/team/roles": [
    { id: "role_manage", module: "Role Matrix", label: "Manage Roles & Matrix", permissionCode: PERMISSIONS.ROLE_MANAGE, description: "Create custom roles and modify permission matrix", isDestructive: true },
    { id: "audit_view", module: "Role Matrix", label: "View Audit Trails", permissionCode: PERMISSIONS.AUDIT_LOG_VIEW, description: "Inspect RBAC audit logs" },
  ],
};

/**
 * Shared helper to evaluate permission source and effective status for an employee.
 */
export async function evaluateEmployeePermissions(userId: string): Promise<{
  effectiveCodes: Set<string>;
  evaluations: Record<string, PermissionEvaluationDetail>;
  user: any;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      department: true,
      position: true,
      subjectScope: true,
      batchScope: true,
      contractEnd: true,
      role: {
        select: {
          id: true,
          name: true,
          label: true,
          description: true,
          isSystem: true,
          permissions: {
            select: {
              permission: { select: { code: true } },
            },
          },
        },
      },
      userPermissionOverrides: {
        select: {
          permissionCode: true,
          granted: true,
          reason: true,
        },
      },
    },
  });

  if (!user) throw new Error("User not found");

  const isSuperAdmin =
    user.role?.name === "SUPER_ADMIN" ||
    user.role?.name === "FOUNDER" ||
    user.role?.name === "ADMIN";

  const isAccountActive =
    user.status === "ACTIVE" &&
    (!user.contractEnd || new Date(user.contractEnd) >= new Date());

  const roleName = user.role?.name || "";
  const roleDefaults = new Set(ROLE_PERMISSION_DEFAULTS[roleName] || []);
  const dbRolePerms = new Set(
    (user.role?.permissions || []).map((p) => p.permission.code)
  );
  const overridesMap = new Map<string, { granted: boolean; reason: string | null }>();
  for (const o of user.userPermissionOverrides) {
    overridesMap.set(o.permissionCode, { granted: o.granted, reason: o.reason });
  }

  const allCatalogueCodes = Object.values(PERMISSIONS) as string[];
  const effectiveCodes = new Set<string>();
  const evaluations: Record<string, PermissionEvaluationDetail> = {};

  for (const code of allCatalogueCodes) {
    // 1. Account Inactive check
    if (!isAccountActive) {
      evaluations[code] = {
        code,
        granted: false,
        source: "ACCOUNT_INACTIVE",
        sourceLabel: "Account Inactive / Suspended / Expired",
        reason: `User status is ${user.status}${user.contractEnd ? " (Contract ended)" : ""}. All access is blocked.`,
      };
      continue;
    }

    // 2. Check User Override first (Overrides take precedence over role)
    if (overridesMap.has(code)) {
      const override = overridesMap.get(code)!;
      if (override.granted) {
        effectiveCodes.add(code);
        evaluations[code] = {
          code,
          granted: true,
          source: "USER_OVERRIDE_GRANTED",
          sourceLabel: "Direct User Override (Granted)",
          reason: override.reason || "Explicitly granted to this user by Administrator.",
        };
      } else {
        evaluations[code] = {
          code,
          granted: false,
          source: "USER_OVERRIDE_DENIED",
          sourceLabel: "Direct User Override (Denied)",
          reason: override.reason || "Explicitly denied for this user by Administrator.",
        };
      }
      continue;
    }

    // 3. Super Admin bypass
    if (isSuperAdmin) {
      effectiveCodes.add(code);
      evaluations[code] = {
        code,
        granted: true,
        source: "SUPER_ADMIN_BYPASS",
        sourceLabel: `${user.role?.label || roleName} Executive Bypass`,
        reason: "Administrative executive role possesses unrestricted platform authority.",
      };
      continue;
    }

    // 4. Role Database permissions
    if (dbRolePerms.has(code)) {
      effectiveCodes.add(code);
      evaluations[code] = {
        code,
        granted: true,
        source: "ROLE_DATABASE",
        sourceLabel: `Role Grant (${user.role?.label || roleName})`,
        reason: `Configured in database permissions for role '${user.role?.label || roleName}'.`,
      };
      continue;
    }

    // 5. Role Default catalogue permissions
    if (roleDefaults.has(code as PermissionCode)) {
      effectiveCodes.add(code);
      evaluations[code] = {
        code,
        granted: true,
        source: "ROLE_DEFAULT",
        sourceLabel: `Role Baseline (${user.role?.label || roleName})`,
        reason: `Standard default permission for role '${user.role?.label || roleName}'.`,
      };
      continue;
    }

    // 6. Not granted
    evaluations[code] = {
      code,
      granted: false,
      source: "NOT_GRANTED",
      sourceLabel: "Not Granted",
      reason: `Neither role '${user.role?.label || roleName}' nor direct overrides grant this action.`,
    };
  }

  return { effectiveCodes, evaluations, user };
}

/**
 * Shared helper to evaluate permission source and effective status for a Role definition.
 */
export async function evaluateRolePermissions(roleName: string): Promise<{
  effectiveCodes: Set<string>;
  evaluations: Record<string, PermissionEvaluationDetail>;
  role: any;
}> {
  const role = await prisma.role.findUnique({
    where: { name: roleName as any },
    include: {
      permissions: {
        select: {
          permission: { select: { code: true } },
        },
      },
      _count: {
        select: { users: true },
      },
    },
  });

  if (!role) throw new Error(`Role '${roleName}' not found`);

  const isSuperAdmin =
    role.name === "SUPER_ADMIN" ||
    role.name === "FOUNDER" ||
    role.name === "ADMIN";

  const roleDefaults = new Set(ROLE_PERMISSION_DEFAULTS[role.name] || []);
  const dbRolePerms = new Set(
    role.permissions.map((p) => p.permission.code)
  );

  const allCatalogueCodes = Object.values(PERMISSIONS) as string[];
  const effectiveCodes = new Set<string>();
  const evaluations: Record<string, PermissionEvaluationDetail> = {};

  for (const code of allCatalogueCodes) {
    if (isSuperAdmin) {
      effectiveCodes.add(code);
      evaluations[code] = {
        code,
        granted: true,
        source: "SUPER_ADMIN_BYPASS",
        sourceLabel: `${role.label} Authority`,
        reason: "Administrative executive role possesses unrestricted platform authority.",
      };
      continue;
    }

    if (dbRolePerms.has(code)) {
      effectiveCodes.add(code);
      evaluations[code] = {
        code,
        granted: true,
        source: "ROLE_DATABASE",
        sourceLabel: `Role Database Config`,
        reason: `Attached to role '${role.label}' in database.`,
      };
      continue;
    }

    if (roleDefaults.has(code as PermissionCode)) {
      effectiveCodes.add(code);
      evaluations[code] = {
        code,
        granted: true,
        source: "ROLE_DEFAULT",
        sourceLabel: `Role Default`,
        reason: `Baseline default permission for '${role.label}'.`,
      };
      continue;
    }

    evaluations[code] = {
      code,
      granted: false,
      source: "NOT_GRANTED",
      sourceLabel: "Not Granted",
      reason: `Not configured for role '${role.label}'.`,
    };
  }

  return { effectiveCodes, evaluations, role };
}

/**
 * Calculates sidebar visibility for every item in TEAM_NAV_CONFIG.
 */
export function calculateSidebarEvaluation(
  effectiveCodes: Set<string>,
  isSuperAdmin: boolean,
  evaluations: Record<string, PermissionEvaluationDetail>
): SidebarEvaluationResult {
  const groups: SimulatedSidebarGroup[] = TEAM_NAV_CONFIG.map((group) => ({
    title: group.title,
    items: group.items.map((item) => {
      // Super admin preview item is hidden in employee simulation
      if (item.href === "/team/role-preview") {
        return {
          ...item,
          status: "HIDDEN",
          state: "HIDDEN",
          reason: "Exclusive to Super Admin. Hidden from simulated staff.",
          requiredPermission: item.permission,
          requiredPermissions: [item.permission],
        };
      }

      if (item.superAdminOnly && !isSuperAdmin) {
        return {
          ...item,
          status: "HIDDEN",
          state: "HIDDEN",
          reason: "Requires Super Admin executive authority. Completely hidden from staff sidebar.",
          requiredPermission: item.permission,
          requiredPermissions: [item.permission],
        };
      }

      const hasPerm = isSuperAdmin || effectiveCodes.has(item.permission);
      const evalDetail = evaluations[item.permission];

      if (hasPerm) {
        return {
          ...item,
          status: "VISIBLE",
          state: "VISIBLE",
          reason: `Visible. Required permission '${item.permission}' is granted (${evalDetail?.sourceLabel || "Active"}).`,
          requiredPermission: item.permission,
          requiredPermissions: [item.permission],
        };
      } else {
        return {
          ...item,
          status: "HIDDEN",
          state: "HIDDEN",
          reason: `Hidden from sidebar. User lacks required permission '${item.permission}'.`,
          requiredPermission: item.permission,
          requiredPermissions: [item.permission],
        };
      }
    }),
  }));

  const items = groups.flatMap((g) => g.items);
  const visibleCount = items.filter((i) => i.status === "VISIBLE").length;

  return {
    groups,
    items,
    visibleCount,
    totalCount: items.length,
  };
}

/**
 * Builds module-wise permission matrix from PERMISSION_GROUPS.
 */
export function buildModuleMatrix(
  effectiveCodes: Set<string>
): ModulePermissionSummary[] {
  return PERMISSION_GROUPS.map((grp) => {
    const actions = grp.actions.map((act) => ({
      code: act.code,
      label: act.label,
      granted: effectiveCodes.has(act.code),
    }));

    const viewAct = actions.find((a) => a.code.includes(".read") || a.code.includes(".view"));
    const createAct = actions.find((a) => a.code.includes(".create") || a.code.includes(".upload"));
    const editAct = actions.find((a) => a.code.includes(".update") || a.code.includes(".edit"));
    const deleteAct = actions.find((a) => a.code.includes(".delete"));
    const approveAct = actions.find((a) => a.code.includes(".approve") || a.code.includes(".verify"));
    const publishAct = actions.find((a) => a.code.includes(".publish"));
    const exportAct = actions.find((a) => a.code.includes(".export") || a.code.includes(".download"));
    const manageAct = actions.find((a) => a.code.includes(".manage"));

    const canView = viewAct ? viewAct.granted : actions.some((a) => a.granted);
    const canCreate = createAct ? createAct.granted : false;
    const canEdit = editAct ? editAct.granted : false;
    const canDelete = deleteAct ? deleteAct.granted : false;
    const canApprove = approveAct ? approveAct.granted : false;
    const canPublish = publishAct ? publishAct.granted : false;
    const canExport = exportAct ? exportAct.granted : false;
    const canManage = manageAct ? manageAct.granted : false;

    return {
      module: grp.name,
      moduleLabel: grp.name,
      view: canView,
      create: canCreate,
      edit: canEdit,
      delete: canDelete,
      approve: canApprove,
      publish: canPublish,
      export: canExport,
      manage: canManage,
      canView,
      canCreate,
      canEdit,
      canDelete,
      canApprove,
      canPublish,
      canExport,
      canManage,
      actions,
    };
  });
}

/**
 * Evaluates button-level actions for each module in PAGE_ACTIONS_CATALOGUE.
 */
export function buildButtonActions(
  effectiveCodes: Set<string>,
  evaluations: Record<string, PermissionEvaluationDetail>
): Record<string, SimulatedButtonAction[]> {
  const result: Record<string, SimulatedButtonAction[]> = {};

  for (const [route, actions] of Object.entries(PAGE_ACTIONS_CATALOGUE)) {
    result[route] = actions.map((act) => {
      const allowed = effectiveCodes.has(act.permissionCode);
      const evalDetail = evaluations[act.permissionCode];

      let uiState: "VISIBLE" | "HIDDEN" | "DISABLED_READONLY" = "HIDDEN";
      if (allowed) {
        uiState = "VISIBLE";
      } else if (act.isDestructive) {
        uiState = "HIDDEN";
      } else {
        uiState = "DISABLED_READONLY";
      }

      return {
        ...act,
        allowed,
        uiState,
        state: uiState,
        requiredPermission: act.permissionCode,
        source: evalDetail?.source || "NOT_GRANTED",
        reason: evalDetail?.reason || (allowed ? "Allowed" : "Forbidden"),
      };
    });
  }

  return result;
}

/**
 * Full Simulation for an Employee.
 */
export async function simulateEmployee(userId: string): Promise<SimulationResult> {
  const { effectiveCodes, evaluations, user } = await evaluateEmployeePermissions(userId);

  const isSuperAdmin =
    user.role?.name === "SUPER_ADMIN" ||
    user.role?.name === "FOUNDER" ||
    user.role?.name === "ADMIN";

  const sidebarEvaluation = calculateSidebarEvaluation(effectiveCodes, isSuperAdmin, evaluations);
  const moduleMatrix = buildModuleMatrix(effectiveCodes);
  const buttonActions = buildButtonActions(effectiveCodes, evaluations);
  const pageActions = Object.values(buttonActions).flat();

  const studentPiiAccessible = effectiveCodes.has(PERMISSIONS.STUDENT_READ_ANY);
  const financialDataAccessible = effectiveCodes.has(PERMISSIONS.FINANCE_READ);

  const subjectScope = user.subjectScope || [];
  const batchScope = user.batchScope || [];

  let scopeSummary = "General platform access.";
  if (subjectScope.length > 0 && batchScope.length > 0) {
    scopeSummary = `Scoped strictly to ${subjectScope.join(", ")} subjects in batches: ${batchScope.join(", ")}.`;
  } else if (subjectScope.length > 0) {
    scopeSummary = `Subject scope restricted to ${subjectScope.join(", ")}.`;
  } else if (batchScope.length > 0) {
    scopeSummary = `Batch scope restricted to ${batchScope.join(", ")}.`;
  }

  const allCatalogueCodes = Object.values(PERMISSIONS) as string[];
  const detailedPermissions = allCatalogueCodes.map((code) => {
    const ev = evaluations[code];
    return {
      code,
      granted: ev?.granted || false,
      source: ev?.source || "NOT_GRANTED",
      sourceLabel: ev?.sourceLabel || "Not Granted",
      reason: ev?.reason || "Not configured.",
      details: ev?.reason || "Not configured.",
    };
  });

  const targetInfo: SimulationTargetInfo = {
    type: "EMPLOYEE",
    id: user.id,
    name: user.name,
    email: user.email,
    code: user.id.slice(-6).toUpperCase(),
    department: user.department || "General Operations",
    position: user.position || user.role?.label || "Staff Member",
    roleName: user.role?.name || "NONE",
    roleLabel: user.role?.label || "No Role Assigned",
    status: user.status,
    overridesCount: user.userPermissionOverrides?.length || 0,
    subjectScope,
    batchScope,
    contractEnd: user.contractEnd ? new Date(user.contractEnd).toISOString() : null,
  };

  return {
    simulatedTarget: targetInfo,
    targetUser: targetInfo,
    totalGrantedCount: effectiveCodes.size,
    effectivePermissions: Array.from(effectiveCodes),
    permissionEvaluations: evaluations,
    detailedPermissions,
    sidebarEvaluation,
    moduleMatrix,
    buttonActions,
    pageActions,
    dataScope: {
      subjectScope,
      batchScope,
      studentPiiAccessible,
      studentPiiRestricted: !studentPiiAccessible,
      financialDataAccessible,
      financeRestricted: !financialDataAccessible,
      summary: scopeSummary,
    },
  };
}

/**
 * Full Simulation for a Role.
 */
export async function simulateRole(roleName: string): Promise<SimulationResult> {
  const { effectiveCodes, evaluations, role } = await evaluateRolePermissions(roleName);

  const isSuperAdmin =
    role.name === "SUPER_ADMIN" ||
    role.name === "FOUNDER" ||
    role.name === "ADMIN";

  const sidebarEvaluation = calculateSidebarEvaluation(effectiveCodes, isSuperAdmin, evaluations);
  const moduleMatrix = buildModuleMatrix(effectiveCodes);
  const buttonActions = buildButtonActions(effectiveCodes, evaluations);
  const pageActions = Object.values(buttonActions).flat();

  const studentPiiAccessible = effectiveCodes.has(PERMISSIONS.STUDENT_READ_ANY);
  const financialDataAccessible = effectiveCodes.has(PERMISSIONS.FINANCE_READ);

  const allCatalogueCodes = Object.values(PERMISSIONS) as string[];
  const detailedPermissions = allCatalogueCodes.map((code) => {
    const ev = evaluations[code];
    return {
      code,
      granted: ev?.granted || false,
      source: ev?.source || "NOT_GRANTED",
      sourceLabel: ev?.sourceLabel || "Not Granted",
      reason: ev?.reason || "Not configured.",
      details: ev?.reason || "Not configured.",
    };
  });

  const targetInfo: SimulationTargetInfo = {
    type: "ROLE",
    id: role.id,
    name: role.label,
    code: role.name,
    department: "All Departments",
    position: role.label,
    roleName: role.name,
    roleLabel: role.label,
    status: "ACTIVE",
    overridesCount: 0,
    subjectScope: [],
    batchScope: [],
  };

  return {
    simulatedTarget: targetInfo,
    targetUser: targetInfo,
    totalGrantedCount: effectiveCodes.size,
    effectivePermissions: Array.from(effectiveCodes),
    permissionEvaluations: evaluations,
    detailedPermissions,
    sidebarEvaluation,
    moduleMatrix,
    buttonActions,
    pageActions,
    dataScope: {
      subjectScope: [],
      batchScope: [],
      studentPiiAccessible,
      studentPiiRestricted: !studentPiiAccessible,
      financialDataAccessible,
      financeRestricted: !financialDataAccessible,
      summary: "Role default baseline. Applied across all assigned members without individual data scopes.",
    },
  };
}

/**
 * Compare two simulation results side-by-side.
 */
export function compareSimulations(res1: SimulationResult, res2: SimulationResult): ComparisonResult {
  const set1 = new Set(res1.effectivePermissions);
  const set2 = new Set(res2.effectivePermissions);

  const both: string[] = [];
  const only1: string[] = [];
  const only2: string[] = [];

  const allCodes = Array.from(new Set([...res1.effectivePermissions, ...res2.effectivePermissions]));

  for (const code of allCodes) {
    if (set1.has(code) && set2.has(code)) {
      both.push(code);
    } else if (set1.has(code)) {
      only1.push(code);
    } else if (set2.has(code)) {
      only2.push(code);
    }
  }

  // Sidebar differences
  const nav1Items = Array.isArray(res1.sidebarEvaluation)
    ? (res1.sidebarEvaluation as any).flatMap((g: any) => g.items)
    : res1.sidebarEvaluation.items;
  const nav2Items = Array.isArray(res2.sidebarEvaluation)
    ? (res2.sidebarEvaluation as any).flatMap((g: any) => g.items)
    : res2.sidebarEvaluation.items;

  const sidebarDifferences = nav1Items.map((item1) => {
    const item2 = nav2Items.find((i) => i.href === item1.href);
    const target1State = item1.status;
    const target2State = item2?.status || "HIDDEN";
    return {
      href: item1.href,
      label: item1.label,
      target1State,
      target2State,
      status1: target1State,
      status2: target2State,
      isDifferent: target1State !== target2State,
    };
  }).filter((d) => d.isDifferent);

  return {
    sharedPermissions: both,
    exclusiveTo1: only1,
    exclusiveTo2: only2,
    sharedCount: both.length,
    exclusiveTo1Count: only1.length,
    exclusiveTo2Count: only2.length,
    both,
    only1,
    only2,
    bothCount: both.length,
    only1Count: only1.length,
    only2Count: only2.length,
    sidebarDifferences,
  };
}

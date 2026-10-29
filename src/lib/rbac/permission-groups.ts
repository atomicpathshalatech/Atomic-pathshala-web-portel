/**
 * Every permission in the catalogue (./permissions.ts), grouped for the
 * Roles & Permissions page and a user's access page. The hand-named groups
 * come first with their labels; every other permission goes into a group for
 * its area (the part of its code before the first "."). A permission added
 * to the catalogue shows up on both pages by itself — nothing else to change.
 */
import { PERMISSIONS } from "./permissions";

export type PermissionGroup = { name: string; actions: { code: string; label: string }[] };

const MODULE_GROUPS = [
  {
    name: "Question Bank",
    actions: [
      { code: "question.read", label: "View" },
      { code: "question.create", label: "Create" },
      { code: "question.update", label: "Edit" },
      { code: "question.delete", label: "Delete" },
      { code: "question.verify", label: "Verify" },
      { code: "question.approve", label: "Approve" },
      { code: "question.reject", label: "Reject" },
      { code: "question.import", label: "Import" },
      { code: "question.export", label: "Export" },
    ],
  },
  {
    name: "Test Portal",
    actions: [
      { code: "test.read", label: "View" },
      { code: "test.create", label: "Create" },
      { code: "test.update", label: "Edit" },
      { code: "test.delete", label: "Delete" },
      { code: "test.publish", label: "Publish" },
      { code: "test.approve", label: "Approve" },
      { code: "test.reject", label: "Reject" },
      { code: "test.export", label: "Export" },
      { code: "test.import", label: "Import" },
    ],
  },
  {
    name: "DPP (Daily Practice Problems)",
    actions: [
      { code: "dpp.read", label: "View" },
      { code: "dpp.create", label: "Create" },
      { code: "dpp.update", label: "Edit" },
      { code: "dpp.delete", label: "Delete" },
      { code: "dpp.publish", label: "Publish" },
      { code: "dpp.approve", label: "Approve" },
      { code: "dpp.reject", label: "Reject" },
    ],
  },
  {
    name: "Doubt Desk",
    actions: [
      { code: "doubt.read", label: "View" },
      { code: "doubt.resolve", label: "Resolve" },
      { code: "doubt.review", label: "Review" },
    ],
  },
  {
    name: "Batches & Courses",
    actions: [
      { code: "batch.read", label: "View" },
      { code: "batch.create", label: "Create" },
      { code: "batch.update", label: "Edit" },
      { code: "batch.delete", label: "Delete" },
      { code: "batch.enrollment.manage", label: "Enrollments" },
      { code: "batch.schedule.manage", label: "Schedule" },
    ],
  },
  {
    name: "Design Studio",
    actions: [
      { code: "design.read", label: "View" },
      { code: "design.create", label: "Create" },
      { code: "design.update", label: "Edit" },
      { code: "design.delete", label: "Delete" },
      { code: "design.publish", label: "Publish" },
      { code: "design.asset.upload", label: "Upload" },
    ],
  },
  {
    name: "Video Production",
    actions: [
      { code: "video.read", label: "View" },
      { code: "video.create", label: "Create" },
      { code: "video.update", label: "Edit" },
      { code: "video.delete", label: "Delete" },
      { code: "video.publish", label: "Publish" },
      { code: "video.upload", label: "Upload" },
    ],
  },
  {
    name: "CRM & Sales",
    actions: [
      { code: "crm.lead.read", label: "View Leads" },
      { code: "crm.lead.create", label: "Add Lead" },
      { code: "crm.lead.assign", label: "Assign" },
      { code: "crm.lead.update", label: "Update" },
      { code: "crm.lead.delete", label: "Delete" },
      { code: "crm.sales.report.view", label: "Reports" },
    ],
  },
  {
    name: "Administration & RBAC",
    actions: [
      { code: "admin.user.read", label: "View Users" },
      { code: "admin.user.create", label: "Create User" },
      { code: "admin.user.update", label: "Edit User" },
      { code: "admin.user.delete", label: "Delete User" },
      { code: "admin.role.manage", label: "Role Matrix" },
      { code: "admin.department.manage", label: "Departments" },
      { code: "admin.audit.view", label: "Audit Logs" },
    ],
  },
];

/** Names for each area (the part of a permission code before the first "."). */
const AREA_NAMES: Record<string, string> = {
  student: "Students",
  teacher: "Teachers",
  faculty: "Faculty Directory",
  course: "Courses",
  finance: "Finance",
  subscription: "Subscriptions",
  analytics: "Analytics",
  founder: "Founder Dashboard",
  marketing: "Marketing & Coupons",
  team: "Team Portal",
  whiteboard: "Live Class — Whiteboard",
  classroom: "Live Class — Classroom",
  live_class: "Live Class — Administration",
  lecture: "Lectures",
  recorded_lecture: "Recorded Lectures",
  chapter: "Chapters",
  study_material: "Study Material",
  document: "Documents",
  onboarding: "Onboarding",
  contract: "Contracts",
  penalty: "Penalties",
  leaderboard: "Leaderboard",
  cms: "Website CMS",
  aichat: "AI Chat",
  predictor: "College Predictor",
  security: "Security",
  module: "Modules",
  communication: "Communication Center",
  whatsapp: "WhatsApp",
  message: "Messages",
  apps: "App Downloads",
};

const humanize = (s: string) =>
  s
    .split(/[._]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

export const PERMISSION_GROUPS: PermissionGroup[] = (() => {
  const listed = new Set(MODULE_GROUPS.flatMap((g) => g.actions.map((a) => a.code)));
  const byArea = new Map<string, { code: string; label: string }[]>();
  for (const code of Object.values(PERMISSIONS) as string[]) {
    if (listed.has(code)) continue;
    const [area, ...rest] = code.split(".");
    if (!byArea.has(area!)) byArea.set(area!, []);
    byArea.get(area!)!.push({ code, label: humanize(rest.join(".")) || humanize(area!) });
  }
  const extra = Array.from(byArea.entries())
    .map(([area, actions]) => ({ name: AREA_NAMES[area] ?? humanize(area), actions }))
    .sort((a, b) => a.name.localeCompare(b.name));
  // Areas that already have a named group get their unlisted permissions added to it.
  const named = MODULE_GROUPS.map((g) => {
    const area = g.actions[0]?.code.split(".")[0];
    const more = extra.find((e) => area && e.name === (AREA_NAMES[area] ?? humanize(area)));
    return more ? { ...g, actions: [...g.actions, ...more.actions] } : g;
  });
  const mergedNames = new Set(named.map((g) => g.name));
  return [...named, ...extra.filter((e) => !named.some((g) => g.actions.some((a) => e.actions.includes(a))) && !mergedNames.has(e.name))];
})();


import "server-only";
import { randomInt } from "crypto";
import type { IdCardKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";

/** Team cards are HR's (user status management); student cards need student-record rights. */
export function canManageCards(userId: string, kind: IdCardKind): Promise<boolean> {
  return hasPermission(userId, kind === "TEAM" ? PERMISSIONS.USER_STATUS_MANAGE : PERMISSIONS.STUDENT_UPDATE);
}

/** EMP-######## (the invite flow's format), unused by any Teacher or ID card. */
export async function allocateEmployeeCode(maxTries = 25): Promise<string> {
  for (let i = 0; i < maxTries; i++) {
    let digits = "";
    for (let d = 0; d < 8; d++) digits += randomInt(0, 10).toString();
    const code = `EMP-${digits}`;
    const [t, c] = await Promise.all([
      prisma.teacher.findUnique({ where: { employeeCode: code }, select: { id: true } }),
      prisma.idCard.findUnique({ where: { employeeCode: code }, select: { id: true } }),
    ]);
    if (!t && !c) return code;
  }
  throw new Error("Could not allocate a unique employee ID — try again.");
}

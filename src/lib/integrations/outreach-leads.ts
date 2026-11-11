import "server-only";
import { prisma } from "@/lib/db";
import { CRMLeadStatus, CRMLeadPriority, CRMLeadSource } from "@prisma/client";

export type OutreachContact = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  studentClass: string | null;
  targetExam: string | null;
  city: string | null;
  leadSource: string;
};

export type OutreachUser = { id: string; name: string; role: string };

export type OutreachLead = {
  id: string;
  status: string;
  stage: string;
  score: number;
  targetCourse: string | null;
  targetBatch: string | null;
  isConvertedToLms: boolean;
  registrationUrl: string | null;
  createdAt: string;
  updatedAt: string;
  contact: OutreachContact;
  assignedUser: OutreachUser | null;
};

export class OutreachIntegrationError extends Error {
  constructor(message = "CRM Service Error") {
    super(message);
    this.name = "OutreachIntegrationError";
  }
}

function mapCrmLeadToOutreach(lead: any): OutreachLead {
  return {
    id: lead.id,
    status: lead.priority === "HOT" ? "HOT" : lead.isConverted ? "CONVERTED" : lead.status,
    stage: lead.status,
    score: lead.score,
    targetCourse: lead.preferredCourse || lead.targetCourse?.title || null,
    targetBatch: lead.targetBatch?.name || null,
    isConvertedToLms: lead.isConverted,
    registrationUrl: null,
    createdAt: lead.createdAt instanceof Date ? lead.createdAt.toISOString() : String(lead.createdAt),
    updatedAt: lead.updatedAt instanceof Date ? lead.updatedAt.toISOString() : String(lead.updatedAt),
    contact: {
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      studentClass: lead.studentClass,
      targetExam: lead.targetExam,
      city: lead.city,
      leadSource: lead.source,
    },
    assignedUser: lead.assignedUser
      ? {
          id: lead.assignedUser.id,
          name: lead.assignedUser.name,
          role: lead.assignedUser.role?.label || "Counsellor",
        }
      : null,
  };
}

/**
 * Returns leads directly from the native integrated Atomic Pathshala CRM
 */
export async function getOutreachLeads(status?: string): Promise<OutreachLead[]> {
  try {
    const where: any = { deletedAt: null };
    if (status && status !== "ALL") {
      if (status === "HOT") {
        where.priority = CRMLeadPriority.HOT;
      } else if (status === "CONVERTED") {
        where.isConverted = true;
      } else if (Object.values(CRMLeadStatus).includes(status as any)) {
        where.status = status as CRMLeadStatus;
      }
    }

    const leads = await prisma.cRMLead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        assignedUser: {
          select: { id: true, name: true, role: { select: { label: true } } },
        },
        targetCourse: { select: { title: true } },
        targetBatch: { select: { name: true } },
      },
    });

    return leads.map(mapCrmLeadToOutreach);
  } catch (error) {
    console.error("[CRM_GET_LEADS_ERROR]", error);
    throw new OutreachIntegrationError("Could not retrieve leads from the database.");
  }
}

/**
 * Returns available counsellors / staff from the native system
 */
export async function getOutreachUsers(): Promise<OutreachUser[]> {
  try {
    const users = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        role: {
          name: { in: ["ADMIN", "SUPER_ADMIN", "SALES", "MARKETING", "TEACHER", "FOUNDER"] },
        },
      },
      select: {
        id: true,
        name: true,
        role: { select: { label: true } },
      },
      orderBy: { name: "asc" },
    });

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role?.label || "Staff",
    }));
  } catch (error) {
    console.error("[CRM_GET_USERS_ERROR]", error);
    return [];
  }
}

/**
 * Updates a lead in the native database
 */
export async function updateOutreachLead(
  leadId: string,
  data: { status?: string; stage?: string; assignedUserId?: string | null }
): Promise<OutreachLead> {
  try {
    const updateData: any = {};
    if (data.status) {
      if (data.status === "HOT") {
        updateData.priority = CRMLeadPriority.HOT;
      } else if (data.status === "CONVERTED") {
        updateData.status = CRMLeadStatus.ENROLLED;
        updateData.isConverted = true;
      } else if (Object.values(CRMLeadStatus).includes(data.status as any)) {
        updateData.status = data.status as CRMLeadStatus;
      }
    }
    if (data.assignedUserId !== undefined) {
      updateData.assignedUserId = data.assignedUserId;
      if (data.assignedUserId && !updateData.status) {
        updateData.status = CRMLeadStatus.ASSIGNED;
      }
    }

    const updated = await prisma.cRMLead.update({
      where: { id: leadId },
      data: updateData,
      include: {
        assignedUser: {
          select: { id: true, name: true, role: { select: { label: true } } },
        },
        targetCourse: { select: { title: true } },
        targetBatch: { select: { name: true } },
      },
    });

    return mapCrmLeadToOutreach(updated);
  } catch (error) {
    console.error("[CRM_UPDATE_LEAD_ERROR]", error);
    throw new OutreachIntegrationError("Could not update the lead in the database.");
  }
}

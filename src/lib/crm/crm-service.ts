import "server-only";
import { prisma } from "@/lib/db";
import {
  CRMLeadStatus,
  CRMLeadPriority,
  CRMLeadSource,
  CRMActivityType,
  CRMFollowUpType,
  CRMFollowUpStatus,
  CRMCallOutcome,
  CRMCounsellingOutcome,
  Prisma,
} from "@prisma/client";

export interface LeadFilterParams {
  search?: string;
  status?: string;
  priority?: string;
  source?: string;
  assignedUserId?: string;
  campaignId?: string;
  targetExam?: string;
  studentClass?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/**
 * Normalizes a phone number to standard format (digits only, strip country code for cleanPhone)
 */
export function normalizePhoneNumber(rawPhone: string): { phone: string; cleanPhone: string } {
  const digits = rawPhone.replace(/\D/g, "");
  const cleanPhone = digits.length > 10 ? digits.slice(-10) : digits;
  const phone = digits.startsWith("91") && digits.length === 12 ? `+${digits}` : cleanPhone.length === 10 ? `+91${cleanPhone}` : `+${digits}`;
  return { phone, cleanPhone };
}

/**
 * Generates an enterprise-standard lead code: APL-YYYYMM-XXXX
 */
export async function generateLeadCode(): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const count = await prisma.cRMLead.count();
  return `APL-${yearMonth}-${String(count + 1).padStart(4, "0")}`;
}

/**
 * Check for duplicate leads by phone, alternate phone, or email
 */
export async function findDuplicateLeads(phone: string, email?: string | null, excludeId?: string) {
  const { cleanPhone } = normalizePhoneNumber(phone);
  const conditions: Prisma.CRMLeadWhereInput[] = [
    { cleanPhone },
    { alternatePhone: { contains: cleanPhone } },
    { phone: { contains: cleanPhone } },
  ];
  if (email && email.trim()) {
    conditions.push({ email: { equals: email.trim(), mode: "insensitive" } });
  }

  const where: Prisma.CRMLeadWhereInput = {
    deletedAt: null,
    OR: conditions,
  };
  if (excludeId) {
    where.id = { not: excludeId };
  }

  return prisma.cRMLead.findMany({
    where,
    select: {
      id: true,
      leadCode: true,
      name: true,
      phone: true,
      email: true,
      status: true,
      score: true,
      createdAt: true,
      assignedUser: { select: { id: true, name: true } },
    },
    take: 5,
  });
}

/**
 * Lead scoring calculator based on operational EdTech criteria
 */
export function calculateLeadScore(data: {
  hasVisitedCourse?: boolean;
  hasVisitedPayment?: boolean;
  hasEnquiredWhatsapp?: boolean;
  hasAttendedDemo?: boolean;
  hasCompletedCounselling?: boolean;
  targetExam?: string | null;
  targetYear?: number | null;
  previousScore?: string | null;
  daysSinceLastActivity?: number;
}): { score: number; priority: CRMLeadPriority } {
  let score = 20; // base score for lead creation

  if (data.hasVisitedCourse) score += 10;
  if (data.hasVisitedPayment) score += 20;
  if (data.hasEnquiredWhatsapp) score += 15;
  if (data.hasAttendedDemo) score += 20;
  if (data.hasCompletedCounselling) score += 25;

  if (data.previousScore && parseInt(data.previousScore, 10) > 400) {
    score += 15; // serious dropper/repeater
  }
  if (data.targetExam === "NEET" || data.targetExam === "JEE") {
    score += 10;
  }

  if (data.daysSinceLastActivity && data.daysSinceLastActivity > 7) {
    score -= Math.min(30, Math.floor(data.daysSinceLastActivity / 7) * 10);
  }

  score = Math.max(0, Math.min(100, score));

  let priority: CRMLeadPriority = CRMLeadPriority.COLD;
  if (score >= 70) priority = CRMLeadPriority.HOT;
  else if (score >= 40) priority = CRMLeadPriority.WARM;

  return { score, priority };
}

/**
 * Fetches leads with comprehensive search, filters, pagination, and sorting
 */
export async function getLeads(params: LeadFilterParams = {}) {
  const {
    search,
    status,
    priority,
    source,
    assignedUserId,
    campaignId,
    targetExam,
    studentClass,
    dateFrom,
    dateTo,
    page = 1,
    limit = 25,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = params;

  const where: Prisma.CRMLeadWhereInput = {
    deletedAt: null,
  };

  if (search && search.trim()) {
    const q = search.trim();
    const clean = q.replace(/\D/g, "");
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { leadCode: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      ...(clean.length >= 4 ? [{ cleanPhone: { contains: clean } }] : []),
    ];
  }

  if (status && status !== "ALL") {
    where.status = status as CRMLeadStatus;
  }
  if (priority && priority !== "ALL") {
    where.priority = priority as CRMLeadPriority;
  }
  if (source && source !== "ALL") {
    where.source = source as CRMLeadSource;
  }
  if (assignedUserId) {
    if (assignedUserId === "UNASSIGNED") {
      where.assignedUserId = null;
    } else {
      where.assignedUserId = assignedUserId;
    }
  }
  if (campaignId && campaignId !== "ALL") {
    where.campaignId = campaignId;
  }
  if (targetExam && targetExam !== "ALL") {
    where.targetExam = targetExam;
  }
  if (studentClass && studentClass !== "ALL") {
    where.studentClass = studentClass;
  }
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }

  const skip = (Math.max(1, page) - 1) * limit;

  const [total, leads] = await Promise.all([
    prisma.cRMLead.count({ where }),
    prisma.cRMLead.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
        campaign: { select: { id: true, name: true, campaignCode: true, platform: true } },
        targetCourse: { select: { id: true, title: true } },
        targetBatch: { select: { id: true, name: true, code: true } },
        student: { select: { id: true, enrollmentNumber: true } },
        followUps: {
          where: { status: "PENDING" },
          orderBy: { scheduledAt: "asc" },
          take: 1,
          select: { id: true, scheduledAt: true, title: true, type: true, priority: true },
        },
        _count: {
          select: {
            activities: true,
            followUps: true,
            callRecords: true,
            counsellingSessions: true,
          },
        },
      },
    }),
  ]);

  return {
    leads,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Get lead detail with full 360-degree activity timeline
 */
export async function getLeadById(id: string) {
  return prisma.cRMLead.findUnique({
    where: { id },
    include: {
      assignedUser: { select: { id: true, name: true, email: true, phone: true } },
      campaign: true,
      targetCourse: true,
      targetBatch: true,
      student: {
        include: {
          user: { select: { id: true, email: true, phone: true, name: true } },
          batchEnrollments: {
            include: { batch: { select: { id: true, name: true, code: true } } },
          },
        },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        include: { performedBy: { select: { id: true, name: true } } },
      },
      followUps: {
        orderBy: { scheduledAt: "desc" },
        include: { counsellor: { select: { id: true, name: true } } },
      },
      callRecords: {
        orderBy: { createdAt: "desc" },
        include: { counsellor: { select: { id: true, name: true } } },
      },
      counsellingSessions: {
        orderBy: { scheduledAt: "desc" },
        include: { counsellor: { select: { id: true, name: true } } },
      },
      duplicates: {
        select: { id: true, leadCode: true, name: true, phone: true, status: true },
      },
      communicationLogs: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
}

/**
 * Create a new Lead with automatic code generation, phone normalization, duplicate checking & activity log
 */
export async function createLead(
  data: {
    name: string;
    phone: string;
    alternatePhone?: string;
    email?: string;
    fatherName?: string;
    motherName?: string;
    studentClass?: string;
    board?: string;
    medium?: string;
    targetExam?: string;
    targetYear?: number;
    preferredSubject?: string;
    preferredCourse?: string;
    targetCourseId?: string;
    targetBatchId?: string;
    state?: string;
    city?: string;
    school?: string;
    expectedBudget?: number;
    source?: CRMLeadSource;
    campaignId?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
    landingPage?: string;
    notes?: string;
    assignedUserId?: string;
  },
  performedById?: string
) {
  const { phone, cleanPhone } = normalizePhoneNumber(data.phone);
  const leadCode = await generateLeadCode();

  // Deduplication warning check
  const duplicates = await findDuplicateLeads(phone, data.email);
  const duplicateOfId = duplicates.length > 0 ? duplicates[0].id : undefined;

  const { score, priority } = calculateLeadScore({
    targetExam: data.targetExam,
    targetYear: data.targetYear,
  });

  const lead = await prisma.cRMLead.create({
    data: {
      leadCode,
      name: data.name,
      phone,
      cleanPhone,
      alternatePhone: data.alternatePhone,
      email: data.email?.toLowerCase().trim() || null,
      fatherName: data.fatherName,
      motherName: data.motherName,
      studentClass: data.studentClass,
      board: data.board,
      medium: data.medium,
      targetExam: data.targetExam,
      targetYear: data.targetYear,
      preferredSubject: data.preferredSubject,
      preferredCourse: data.preferredCourse,
      targetCourseId: data.targetCourseId,
      targetBatchId: data.targetBatchId,
      state: data.state,
      city: data.city,
      school: data.school,
      expectedBudget: data.expectedBudget,
      source: data.source || CRMLeadSource.WEBSITE,
      campaignId: data.campaignId,
      utmSource: data.utmSource,
      utmMedium: data.utmMedium,
      utmCampaign: data.utmCampaign,
      utmContent: data.utmContent,
      utmTerm: data.utmTerm,
      landingPage: data.landingPage,
      firstTouchSource: data.source || CRMLeadSource.WEBSITE,
      lastTouchSource: data.source || CRMLeadSource.WEBSITE,
      assignedUserId: data.assignedUserId,
      status: data.assignedUserId ? CRMLeadStatus.ASSIGNED : CRMLeadStatus.NEW_LEAD,
      priority,
      score,
      notes: data.notes,
      duplicateOfId,
    },
  });

  // Log activity
  await prisma.cRMLeadActivity.create({
    data: {
      leadId: lead.id,
      type: CRMActivityType.STATUS_CHANGE,
      title: "Lead Captured",
      description: `Lead created from ${lead.source} with initial status ${lead.status}. Lead Code: ${leadCode}`,
      performedById,
    },
  });

  return lead;
}

/**
 * Updates lead status, stage, details and writes to activity history
 */
export async function updateLead(
  id: string,
  data: Partial<{
    name: string;
    phone: string;
    email: string;
    studentClass: string;
    board: string;
    medium: string;
    targetExam: string;
    targetYear: number;
    status: CRMLeadStatus;
    priority: CRMLeadPriority;
    score: number;
    assignedUserId: string | null;
    notes: string;
    state: string;
    city: string;
    school: string;
    expectedBudget: number;
    targetCourseId: string | null;
    targetBatchId: string | null;
    nextFollowUpAt: Date | null;
  }>,
  performedById?: string
) {
  const existing = await prisma.cRMLead.findUnique({ where: { id } });
  if (!existing) throw new Error("Lead not found");

  const updateData: Prisma.CRMLeadUpdateInput = { ...data };
  if (data.phone) {
    const { phone, cleanPhone } = normalizePhoneNumber(data.phone);
    updateData.phone = phone;
    updateData.cleanPhone = cleanPhone;
  }

  const updated = await prisma.cRMLead.update({
    where: { id },
    data: updateData,
  });

  // If status changed, record activity
  if (data.status && data.status !== existing.status) {
    await prisma.cRMLeadActivity.create({
      data: {
        leadId: id,
        type: CRMActivityType.STATUS_CHANGE,
        title: `Status changed to ${data.status}`,
        description: `Status transitioned from ${existing.status} to ${data.status}`,
        performedById,
      },
    });
  }

  // If assigned user changed, record activity
  if (data.assignedUserId !== undefined && data.assignedUserId !== existing.assignedUserId) {
    const newUser = data.assignedUserId
      ? await prisma.user.findUnique({ where: { id: data.assignedUserId }, select: { name: true } })
      : null;
    await prisma.cRMLeadActivity.create({
      data: {
        leadId: id,
        type: CRMActivityType.ASSIGNMENT_CHANGED,
        title: newUser ? `Lead assigned to ${newUser.name}` : "Lead unassigned",
        performedById,
      },
    });
  }

  return updated;
}

/**
 * Bulk or single lead assignment
 */
export async function assignLeads(leadIds: string[], assignedUserId: string | null, performedById?: string) {
  const assignee = assignedUserId
    ? await prisma.user.findUnique({ where: { id: assignedUserId }, select: { id: true, name: true } })
    : null;

  await prisma.cRMLead.updateMany({
    where: { id: { in: leadIds } },
    data: {
      assignedUserId,
      status: assignedUserId ? CRMLeadStatus.ASSIGNED : CRMLeadStatus.UNASSIGNED,
    },
  });

  // Create activities for each lead
  for (const leadId of leadIds) {
    await prisma.cRMLeadActivity.create({
      data: {
        leadId,
        type: CRMActivityType.ASSIGNMENT_CHANGED,
        title: assignee ? `Assigned to ${assignee.name}` : "Lead unassigned",
        description: assignee ? `Lead assigned to counsellor ${assignee.name}` : "Lead moved to unassigned queue",
        performedById,
      },
    });
  }

  return { success: true, count: leadIds.length };
}

/**
 * Log call record and automatically update last contacted time and status
 */
export async function logCall(data: {
  leadId: string;
  counsellorId?: string;
  direction?: string;
  durationSeconds?: number;
  outcome: CRMCallOutcome;
  notes?: string;
  nextFollowUpAt?: Date;
}) {
  const call = await prisma.cRMCallRecord.create({
    data: {
      leadId: data.leadId,
      counsellorId: data.counsellorId,
      direction: data.direction || "OUTBOUND",
      durationSeconds: data.durationSeconds || 0,
      outcome: data.outcome,
      notes: data.notes,
      provider: "MANUAL",
    },
  });

  // Update lead's last contact date
  await prisma.cRMLead.update({
    where: { id: data.leadId },
    data: {
      lastContactedAt: new Date(),
      ...(data.nextFollowUpAt ? { nextFollowUpAt: data.nextFollowUpAt } : {}),
      status:
        data.outcome === "ADMISSION_CONFIRMED"
          ? CRMLeadStatus.ADMISSION_CONFIRMED
          : data.outcome === "INTERESTED"
          ? CRMLeadStatus.INTERESTED
          : data.outcome === "NOT_INTERESTED"
          ? CRMLeadStatus.NOT_INTERESTED
          : CRMLeadStatus.CONTACTED,
    },
  });

  // Record activity
  await prisma.cRMLeadActivity.create({
    data: {
      leadId: data.leadId,
      type: CRMActivityType.CALL_LOGGED,
      title: `Call Logged: ${data.outcome}`,
      description: data.notes || `Call outcome: ${data.outcome} (${data.durationSeconds || 0}s)`,
      performedById: data.counsellorId,
    },
  });

  return call;
}

/**
 * Follow-up tasks management
 */
export async function getFollowUps(params: {
  counsellorId?: string;
  status?: CRMFollowUpStatus;
  dateFilter?: "today" | "overdue" | "upcoming" | "all";
}) {
  const where: Prisma.CRMLeadFollowUpWhereInput = {};
  if (params.counsellorId) where.counsellorId = params.counsellorId;
  if (params.status) where.status = params.status;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  if (params.dateFilter === "today") {
    where.scheduledAt = { gte: startOfToday, lte: endOfToday };
    where.status = CRMFollowUpStatus.PENDING;
  } else if (params.dateFilter === "overdue") {
    where.scheduledAt = { lt: startOfToday };
    where.status = CRMFollowUpStatus.PENDING;
  } else if (params.dateFilter === "upcoming") {
    where.scheduledAt = { gt: endOfToday };
    where.status = CRMFollowUpStatus.PENDING;
  }

  return prisma.cRMLeadFollowUp.findMany({
    where,
    orderBy: { scheduledAt: "asc" },
    include: {
      lead: {
        select: {
          id: true,
          leadCode: true,
          name: true,
          phone: true,
          email: true,
          status: true,
          priority: true,
          preferredCourse: true,
        },
      },
      counsellor: { select: { id: true, name: true } },
    },
  });
}

/**
 * Schedule counselling session
 */
export async function scheduleCounselling(data: {
  leadId: string;
  counsellorId?: string;
  scheduledAt: Date;
  mode?: string;
  meetingLink?: string;
  notes?: string;
}) {
  const session = await prisma.cRMCounsellingSession.create({
    data: {
      leadId: data.leadId,
      counsellorId: data.counsellorId,
      scheduledAt: data.scheduledAt,
      mode: data.mode || "PHONE",
      meetingLink: data.meetingLink,
      counsellingNotes: data.notes,
      status: "SCHEDULED",
    },
  });

  await prisma.cRMLead.update({
    where: { id: data.leadId },
    data: {
      status: CRMLeadStatus.COUNSELLING_SCHEDULED,
      nextFollowUpAt: data.scheduledAt,
    },
  });

  await prisma.cRMLeadActivity.create({
    data: {
      leadId: data.leadId,
      type: CRMActivityType.COUNSELLING_SCHEDULED,
      title: "Counselling Scheduled",
      description: `Session set for ${data.scheduledAt.toLocaleString("en-IN")}`,
      performedById: data.counsellorId,
    },
  });

  return session;
}

/**
 * Convert Lead to Enrolled Student in LMS
 */
export async function convertLeadToAdmission(params: {
  leadId: string;
  batchId: string;
  courseFee?: number;
  discount?: number;
  finalAmount?: number;
  paymentTransactionId?: string;
  performedById?: string;
}) {
  const lead = await prisma.cRMLead.findUnique({ where: { id: params.leadId } });
  if (!lead) throw new Error("Lead not found");

  const batch = await prisma.batch.findUnique({ where: { id: params.batchId } });
  if (!batch) throw new Error("Batch not found");

  // Check if Student already exists by mobile/email
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { phone: lead.cleanPhone },
        { phone: lead.phone },
        ...(lead.email ? [{ email: lead.email }] : []),
      ],
    },
    include: { student: true },
  });

  let studentId = existingUser?.student?.id;

  // If no student exists, create Student record linked to User
  if (!studentId) {
    const studentRole = await prisma.role.findUnique({ where: { name: "STUDENT" } });
    if (!studentRole) throw new Error("STUDENT role not found");

    const created = await prisma.$transaction(async (tx) => {
      let userId = existingUser?.id;
      if (!userId) {
        const user = await tx.user.create({
          data: {
            name: lead.name,
            phone: lead.phone,
            email: lead.email || `student.${Date.now()}@atomicpathshala.com`,
            passwordHash: "$2a$12$eX0R7r5p5y9uQzG9l7h.TeOq1u5q0G2wH7...", // temporary hash
            roleId: studentRole.id,
          },
        });
        userId = user.id;
      }

      const count = await tx.student.count();
      const enrollmentNumber = `AP-${new Date().getFullYear()}-${String(count + 1001).padStart(5, "0")}`;
      const studentIdCode = `STU-${String(count + 1).padStart(4, "0")}`;

      const student = await tx.student.create({
        data: {
          userId,
          enrollmentNumber,
          studentIdCode,
          fatherName: lead.fatherName || "Parent",
          motherName: lead.motherName || "Parent",
          dob: new Date("2008-01-01"),
          gender: "OTHER",
          class: lead.studentClass || "Class 12",
          targetExam: lead.targetExam || "NEET",
          school: lead.school || "School",
          city: lead.city || "Delhi",
          state: lead.state || "Delhi",
        },
      });

      return student;
    });

    studentId = created.id;
  }

  // Enroll student into the batch
  await prisma.batchEnrollment.upsert({
    where: {
      batchId_studentId: {
        batchId: batch.id,
        studentId,
      },
    },
    update: { status: "ACTIVE" },
    create: {
      batchId: batch.id,
      studentId,
      status: "ACTIVE",
    },
  });

  // Update CRM Lead status to ENROLLED
  const updatedLead = await prisma.cRMLead.update({
    where: { id: lead.id },
    data: {
      status: CRMLeadStatus.ENROLLED,
      isConverted: true,
      studentId,
      targetBatchId: batch.id,
      targetCourseId: batch.courseId,
    },
  });

  // Record activity
  await prisma.cRMLeadActivity.create({
    data: {
      leadId: lead.id,
      type: CRMActivityType.STUDENT_ENROLLED,
      title: "Admission Confirmed & Enrolled",
      description: `Student enrolled into batch ${batch.name} (${batch.code}). Transaction ID: ${params.paymentTransactionId || "OFFLINE_VERIFIED"}`,
      performedById: params.performedById,
    },
  });

  return { success: true, lead: updatedLead, studentId };
}

/**
 * Merge two leads: preserves activity history, updates duplicate references
 */
export async function mergeLeads(primaryLeadId: string, duplicateLeadId: string, performedById?: string) {
  if (primaryLeadId === duplicateLeadId) throw new Error("Cannot merge a lead into itself");

  const [primary, duplicate] = await Promise.all([
    prisma.cRMLead.findUnique({ where: { id: primaryLeadId } }),
    prisma.cRMLead.findUnique({ where: { id: duplicateLeadId } }),
  ]);

  if (!primary || !duplicate) throw new Error("One or both leads not found");

  // Re-link activities, calls, followups from duplicate to primary
  await prisma.$transaction([
    prisma.cRMLeadActivity.updateMany({
      where: { leadId: duplicateLeadId },
      data: { leadId: primaryLeadId },
    }),
    prisma.cRMCallRecord.updateMany({
      where: { leadId: duplicateLeadId },
      data: { leadId: primaryLeadId },
    }),
    prisma.cRMLeadFollowUp.updateMany({
      where: { leadId: duplicateLeadId },
      data: { leadId: primaryLeadId },
    }),
    prisma.cRMCounsellingSession.updateMany({
      where: { leadId: duplicateLeadId },
      data: { leadId: primaryLeadId },
    }),
    prisma.cRMLead.update({
      where: { id: duplicateLeadId },
      data: {
        status: CRMLeadStatus.DUPLICATE,
        duplicateOfId: primaryLeadId,
        notes: `Merged into ${primary.leadCode} (${primary.name}) on ${new Date().toISOString()}`,
      },
    }),
  ]);

  await prisma.cRMLeadActivity.create({
    data: {
      leadId: primaryLeadId,
      type: CRMActivityType.MERGED_DUPLICATE,
      title: "Duplicate Lead Merged",
      description: `Merged duplicate lead ${duplicate.leadCode} (${duplicate.name}, ${duplicate.phone}) into this profile.`,
      performedById,
    },
  });

  return { success: true, primaryLeadId };
}

/**
 * Enterprise CRM Dashboard Metrics & Funnel Analytics
 */
export async function getCrmDashboardMetrics() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const startOfWeek = new Date(now.getTime() - 7 * 86400000);

  // Batch 1: Primary Lead counts
  const [totalLeads, newToday, thisWeek, unassigned, hotLeads] = await Promise.all([
    prisma.cRMLead.count({ where: { deletedAt: null } }),
    prisma.cRMLead.count({ where: { deletedAt: null, createdAt: { gte: startOfToday } } }),
    prisma.cRMLead.count({ where: { deletedAt: null, createdAt: { gte: startOfWeek } } }),
    prisma.cRMLead.count({ where: { deletedAt: null, assignedUserId: null } }),
    prisma.cRMLead.count({ where: { deletedAt: null, priority: CRMLeadPriority.HOT } }),
  ]);

  // Batch 2: Status & Follow-up counts
  const [contacted, counsellingScheduled, enrolled, lostLeads, followUpsDueToday, overdueFollowUps] = await Promise.all([
    prisma.cRMLead.count({
      where: {
        deletedAt: null,
        status: { in: [CRMLeadStatus.CONTACTED, CRMLeadStatus.INTERESTED, CRMLeadStatus.HIGHLY_INTERESTED] },
      },
    }),
    prisma.cRMLead.count({ where: { deletedAt: null, status: CRMLeadStatus.COUNSELLING_SCHEDULED } }),
    prisma.cRMLead.count({
      where: {
        deletedAt: null,
        status: { in: [CRMLeadStatus.ENROLLED, CRMLeadStatus.ADMISSION_CONFIRMED] },
      },
    }),
    prisma.cRMLead.count({
      where: {
        deletedAt: null,
        status: { in: [CRMLeadStatus.LOST, CRMLeadStatus.NOT_INTERESTED] },
      },
    }),
    prisma.cRMLeadFollowUp.count({
      where: {
        status: CRMFollowUpStatus.PENDING,
        scheduledAt: { gte: startOfToday, lte: endOfToday },
      },
    }),
    prisma.cRMLeadFollowUp.count({
      where: {
        status: CRMFollowUpStatus.PENDING,
        scheduledAt: { lt: startOfToday },
      },
    }),
  ]);

  // Batch 3: Aggregates and relations
  const [statusCounts, sourceCounts, counselorPerformance, campaigns] = await Promise.all([
    prisma.cRMLead.groupBy({
      by: ["status"],
      _count: { id: true },
      where: { deletedAt: null },
    }),
    prisma.cRMLead.groupBy({
      by: ["source"],
      _count: { id: true },
      where: { deletedAt: null },
    }),
    prisma.user.findMany({
      where: {
        crmLeadsAssigned: { some: {} },
      },
      select: {
        id: true,
        name: true,
        email: true,
        _count: {
          select: {
            crmLeadsAssigned: true,
            crmCallRecords: true,
            crmCounsellingSessions: true,
            crmFollowUpsAssigned: true,
          },
        },
      },
    }),
    prisma.cRMCampaign.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { leads: true } },
      },
    }),
  ]);

  const conversionRate = totalLeads > 0 ? ((enrolled / totalLeads) * 100).toFixed(1) : "0.0";

  return {
    kpis: {
      totalLeads,
      newToday,
      thisWeek,
      unassigned,
      hotLeads,
      contacted,
      counsellingScheduled,
      enrolled,
      lostLeads,
      followUpsDueToday,
      overdueFollowUps,
      conversionRate: `${conversionRate}%`,
    },
    funnel: [
      { stage: "Total Inquiries", count: totalLeads },
      { stage: "Contacted Leads", count: contacted },
      { stage: "Counselling Scheduled", count: counsellingScheduled },
      { stage: "Admissions & Enrolled", count: enrolled },
    ],
    statusCounts: statusCounts.map((s) => ({ status: s.status, count: s._count.id })),
    sourceCounts: sourceCounts.map((s) => ({ source: s.source, count: s._count.id })),
    counselorPerformance: counselorPerformance.map((c) => ({
      id: c.id,
      name: c.name,
      assignedLeads: c._count.crmLeadsAssigned,
      callsMade: c._count.crmCallRecords,
      counsellingCompleted: c._count.crmCounsellingSessions,
    })),
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      platform: c.platform,
      spend: c.spend,
      leads: c._count.leads,
      cpl: c._count.leads > 0 ? Math.round(c.spend / c._count.leads) : 0,
    })),
  };
}

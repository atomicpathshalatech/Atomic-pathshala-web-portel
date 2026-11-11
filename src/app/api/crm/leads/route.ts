import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getLeads, createLead, LeadFilterParams } from "@/lib/crm/crm-service";
import { z } from "zod";

const createLeadSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  alternatePhone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  studentClass: z.string().optional(),
  board: z.string().optional(),
  medium: z.string().optional(),
  targetExam: z.string().optional(),
  targetYear: z.number().optional(),
  preferredSubject: z.string().optional(),
  preferredCourse: z.string().optional(),
  targetCourseId: z.string().optional(),
  targetBatchId: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  school: z.string().optional(),
  expectedBudget: z.number().optional(),
  source: z.any().optional(),
  campaignId: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmContent: z.string().optional(),
  utmTerm: z.string().optional(),
  landingPage: z.string().optional(),
  notes: z.string().optional(),
  assignedUserId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LEAD_READ);

    const searchParams = req.nextUrl.searchParams;
    const params: LeadFilterParams = {
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      priority: searchParams.get("priority") || undefined,
      source: searchParams.get("source") || undefined,
      assignedUserId: searchParams.get("assignedUserId") || undefined,
      campaignId: searchParams.get("campaignId") || undefined,
      targetExam: searchParams.get("targetExam") || undefined,
      studentClass: searchParams.get("studentClass") || undefined,
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 25,
      sortBy: searchParams.get("sortBy") || "createdAt",
      sortOrder: (searchParams.get("sortOrder") as "asc" | "desc") || "desc",
    };

    const result = await getLeads(params);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LEAD_CREATE);

    const body = await req.json();
    const validated = createLeadSchema.parse(body);

    const lead = await createLead(validated as any, session.user.id);
    return apiSuccess({ lead }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

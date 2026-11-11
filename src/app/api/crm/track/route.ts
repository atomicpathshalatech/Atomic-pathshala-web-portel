import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { trackLiveStudentActivity } from "@/lib/crm/crm-service";
import { z } from "zod";

const trackSchema = z.object({
  studentId: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  eventType: z.enum(["LOGIN", "COURSE_VISIT", "BATCH_EXPLORED", "CHECKOUT_VISITED", "VIDEO_WATCHED"]),
  title: z.string().min(1),
  description: z.string().min(1),
  metadata: z.record(z.any()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();
    const data = trackSchema.parse(body);

    const result = await trackLiveStudentActivity({
      ...data,
      userId: session?.user?.id,
      email: data.email || session?.user?.email || undefined,
      phone: data.phone || (session?.user as any)?.phone || undefined,
    });

    return apiSuccess({ result });
  } catch (error) {
    return handleApiError(error);
  }
}

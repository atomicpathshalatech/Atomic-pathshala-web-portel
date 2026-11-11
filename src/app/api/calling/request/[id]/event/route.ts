import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { updateCallingRequestEvent } from "@/lib/calling/calling-service";
import { CallingRequestStatus } from "@prisma/client";
import { z } from "zod";

const eventSchema = z.object({
  status: z.nativeEnum(CallingRequestStatus),
  durationSeconds: z.number().optional(),
  failureReason: z.string().optional(),
  outcome: z.string().optional(),
  remarks: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const data = eventSchema.parse(body);

    const updated = await updateCallingRequestEvent({
      requestId: params.id,
      ...data,
    });

    return apiSuccess({ request: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

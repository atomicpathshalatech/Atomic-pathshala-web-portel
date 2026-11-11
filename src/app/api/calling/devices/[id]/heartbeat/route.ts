import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { recordDeviceHeartbeat } from "@/lib/calling/calling-service";
import { z } from "zod";

const heartbeatSchema = z.object({
  fcmToken: z.string().optional(),
  batteryLevel: z.number().optional(),
  networkType: z.string().optional(),
  sim1Carrier: z.string().optional(),
  sim2Carrier: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json().catch(() => ({}));
    const data = heartbeatSchema.parse(body);

    const result = await recordDeviceHeartbeat({
      deviceId: params.id,
      ...data,
    });

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

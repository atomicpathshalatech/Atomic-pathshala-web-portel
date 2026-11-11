import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { registerDeviceFromApp } from "@/lib/calling/calling-service";
import { z } from "zod";

const registerSchema = z.object({
  pairingCode: z.string().min(6).max(6),
  deviceIdentifier: z.string().min(1),
  deviceName: z.string().min(1),
  fcmToken: z.string().optional(),
  androidVersion: z.string().optional(),
  appVersion: z.string().optional(),
  batteryLevel: z.number().optional(),
  networkType: z.string().optional(),
  sim1Carrier: z.string().optional(),
  sim1Number: z.string().optional(),
  sim2Carrier: z.string().optional(),
  sim2Number: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = registerSchema.parse(body);

    const result = await registerDeviceFromApp(data);
    return apiSuccess(result, 200);
  } catch (error) {
    return handleApiError(error);
  }
}

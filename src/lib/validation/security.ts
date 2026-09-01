import { z } from "zod";

export const SECURITY_POLICY_OPTIONS = ["SINGLE_SESSION", "MULTI_SESSION"] as const;

export const securityConfigUpdateSchema = z.object({
  policy: z.enum(SECURITY_POLICY_OPTIONS),
});
export type SecurityConfigUpdateInput = z.infer<typeof securityConfigUpdateSchema>;

import { z } from "zod";

/** Academic Head / HR drafting and sending a contract to a teacher. */
export const contractCreateSchema = z.object({
  teacherId: z.string().min(1),
  title: z.string().min(3, "Title is required"),
  bodyText: z.string().min(20, "Contract terms must be filled in"),
});

export type ContractCreateInput = z.infer<typeof contractCreateSchema>;

/** Teacher e-signing a sent contract — typed full legal name stands in for
 * a wet signature, timestamped and IP-logged for auditability. */
export const contractSignSchema = z.object({
  signedName: z.string().min(2, "Type your full legal name to sign"),
});

export type ContractSignInput = z.infer<typeof contractSignSchema>;

export const contractDeclineSchema = z.object({
  declinedReason: z.string().min(3, "Please provide a reason"),
});

export type ContractDeclineInput = z.infer<typeof contractDeclineSchema>;

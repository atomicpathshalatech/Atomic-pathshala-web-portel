import { z } from "zod";

/**
 * Body for POST /api/integrations/outreach/invite-link — called by the
 * outreach CRM's "Convert to LMS" action. Deliberately only the fields a
 * counselor actually has on a call (name/email/mobile + chosen course and
 * batch); everything the real Student record additionally requires gets
 * collected on the real /register form the resulting link points to.
 */
export const leadInviteCreateSchema = z.object({
  name: z.string().min(2, "Name is required").max(120),
  email: z.string().email("Enter a valid email address"),
  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  courseSlug: z.string().min(1, "Course is required"),
  batchCode: z.string().min(1, "Batch is required"),
  counselorNotes: z.string().max(2000).optional(),
});

export type LeadInviteCreateInput = z.infer<typeof leadInviteCreateSchema>;

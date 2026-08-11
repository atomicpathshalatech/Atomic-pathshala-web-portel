import { z } from "zod";

export const DOCUMENT_TYPE_OPTIONS = [
  "GOVT_ID_FRONT",
  "GOVT_ID_BACK",
  "PAN_CARD",
  "ADDRESS_PROOF",
  "EDUCATION_CERTIFICATE",
  "PHOTO",
] as const;

export const DOCUMENT_TYPE_LABELS: Record<(typeof DOCUMENT_TYPE_OPTIONS)[number], string> = {
  GOVT_ID_FRONT: "Government ID (Front)",
  GOVT_ID_BACK: "Government ID (Back)",
  PAN_CARD: "PAN Card",
  ADDRESS_PROOF: "Address Proof",
  EDUCATION_CERTIFICATE: "Education Certificate",
  PHOTO: "Passport Photo",
};

/** Self-upload — a teacher submitting one KYC document. File is sent as a
 * data URL (base64); in production this would instead be an object-storage
 * URL returned by a signed-upload step. */
export const documentUploadSchema = z.object({
  type: z.enum(DOCUMENT_TYPE_OPTIONS),
  fileUrl: z.string().min(1, "File is required"),
  fileName: z.string().optional(),
});

export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;

/** HR / Academic Head verifying or rejecting a submitted document. */
export const documentVerifySchema = z.object({
  status: z.enum(["VERIFIED", "REJECTED"]),
  rejectionNote: z.string().optional(),
});

export type DocumentVerifyInput = z.infer<typeof documentVerifySchema>;

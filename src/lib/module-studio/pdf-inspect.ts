import "server-only";
import { loadServerPdfJs } from "@/lib/pdf/server-pdf";

/**
 * Checks a PDF before any extraction work is spent on it. The file name and
 * the browser's MIME type are not trusted: the bytes must start like a PDF,
 * PDF.js must be able to open it, and size / page count must be within what
 * one module may hold. Every refusal comes with a code and a fix the person
 * can act on.
 */

export type PdfProblemCode =
  | "NOT_A_PDF"
  | "EMPTY_FILE"
  | "TOO_LARGE"
  | "TOO_MANY_PAGES"
  | "PASSWORD_PROTECTED"
  | "CORRUPTED";

export class PdfInputError extends Error {
  constructor(public readonly code: PdfProblemCode, message: string) {
    super(message);
    this.name = "PdfInputError";
  }
}

export const PDF_LIMITS = {
  maxBytes: () => (Number(process.env.MODULE_MAX_PDF_MB) || 150) * 1024 * 1024,
  maxPages: () => Number(process.env.MODULE_MAX_PDF_PAGES) || 1500,
};

export type PdfInspection = {
  pages: number;
  bytes: number;
  encrypted: boolean;
  metadata: { title?: string; author?: string; subject?: string; producer?: string; creator?: string; pdfVersion?: string };
};

/** "%PDF-" in the first 1 KB (some generators put a few bytes before it). */
export function looksLikePdf(buf: Uint8Array): boolean {
  const head = Buffer.from(buf.subarray(0, Math.min(1024, buf.length))).toString("latin1");
  return head.includes("%PDF-");
}

export async function inspectPdf(buf: Buffer): Promise<PdfInspection> {
  if (buf.length === 0) throw new PdfInputError("EMPTY_FILE", "The file is empty. Upload the PDF again.");
  if (!looksLikePdf(buf)) {
    throw new PdfInputError("NOT_A_PDF", "This file is not a PDF (its contents do not start like one, whatever its name says). Export it as PDF and upload again.");
  }
  if (buf.length > PDF_LIMITS.maxBytes()) {
    throw new PdfInputError(
      "TOO_LARGE",
      `This PDF is ${Math.round(buf.length / 1048576)} MB; a module can be at most ${Math.round(PDF_LIMITS.maxBytes() / 1048576)} MB. Split it into parts (for example by chapter) and upload each part.`
    );
  }
  const pdfjs = await loadServerPdfJs();
  let doc: any;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useWorkerFetch: false, isEvalSupported: false, disableFontFace: true, verbosity: 0 }).promise;
  } catch (err: any) {
    const name = String(err?.name ?? "");
    if (name === "PasswordException" || /password/i.test(String(err?.message))) {
      throw new PdfInputError("PASSWORD_PROTECTED", "This PDF is password-protected. Remove the password (open it, then Print → Save as PDF, or use the tool that made it) and upload again.");
    }
    throw new PdfInputError(
      "CORRUPTED",
      `This PDF could not be opened — it looks damaged or incomplete (${String(err?.message ?? name).slice(0, 120)}). Download/export it again and re-upload.`
    );
  }
  try {
    const pages = doc.numPages as number;
    if (pages > PDF_LIMITS.maxPages()) {
      throw new PdfInputError("TOO_MANY_PAGES", `This PDF has ${pages} pages; a module can have at most ${PDF_LIMITS.maxPages()}. Split it into parts.`);
    }
    let metadata: PdfInspection["metadata"] = {};
    let encrypted = false;
    try {
      const meta = await doc.getMetadata();
      const info = (meta?.info ?? {}) as Record<string, unknown>;
      const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : undefined);
      metadata = {
        title: str(info.Title),
        author: str(info.Author),
        subject: str(info.Subject),
        producer: str(info.Producer),
        creator: str(info.Creator),
        pdfVersion: str(info.PDFFormatVersion),
      };
      encrypted = Boolean(info.IsEncrypted);
    } catch {
      // metadata is optional
    }
    return { pages, bytes: buf.length, encrypted, metadata };
  } finally {
    await doc.destroy?.().catch?.(() => undefined);
  }
}

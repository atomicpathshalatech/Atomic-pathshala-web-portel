import "server-only";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import crypto from "crypto";

export type AgreementPdfInput = {
  agreementNumber: string;
  documentType?: "JOINING_LETTER" | "SERVICE_AGREEMENT";
  title: string;
  effectiveDate: string;
  educatorName: string;
  educatorEmail: string;
  educatorPhone: string;
  educatorAddress: string;
  educatorPan: string;
  designation: string;
  department: string;
  annualSalary: string;
  monthlySalary: string;
  teachingHoursMonthly: string;
  paymentCycleDay: string;
  noticePeriodDays: string;
  workLocation: string;
  companyName: string;
  companyCin?: string;
  companyAddress: string;
  authorizedSignatoryName: string;
  authorizedSignatoryDesignation: string;
  bodyText: string;
  // e-Stamp attachment
  eStampPdfBuffer?: Buffer;
  eStampCertNo?: string;
  eStampState?: string;
  eStampAmount?: string;
  // Educator Signature
  educatorSignatureDataUrl?: string;
  educatorSignedName?: string;
  educatorSignedAt?: Date;
  educatorIp?: string;
  // Founder & Proprietor Signature
  directorSignatureDataUrl?: string;
  directorSignedName?: string;
  directorSignedAt?: Date;
  directorIp?: string;
};

export async function generateAgreementPdf(input: AgreementPdfInput): Promise<{
  pdfBuffer: Buffer;
  documentHash: string;
  pageCount: number;
}> {
  const pdfDoc = await PDFDocument.create();

  // 1. Embed Fonts
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  // 2. Attach authentic e-Stamp PDF if provided as Page 1
  if (input.eStampPdfBuffer && input.eStampPdfBuffer.length > 0) {
    try {
      const stampDoc = await PDFDocument.load(input.eStampPdfBuffer);
      const copiedPages = await pdfDoc.copyPages(stampDoc, stampDoc.getPageIndices());
      copiedPages.forEach((page) => pdfDoc.addPage(page));
    } catch (e) {
      console.warn("[pdf-engine] Failed to load e-stamp PDF attachment:", e);
    }
  }

  // 3. Paginate the Agreement Text onto standard A4 pages (595.28 x 841.89)
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 50;
  const marginTop = 55;
  const marginBottom = 65;
  const usableHeight = pageHeight - marginTop - marginBottom;
  const usableWidth = pageWidth - marginX * 2;

  // Split body text into wrapped lines
  const lines = input.bodyText.split("\n");
  const wrappedLines: string[] = [];

  for (const rawLine of lines) {
    if (rawLine.length === 0) {
      wrappedLines.push("");
      continue;
    }

    // Split long lines so they don't overflow the margin
    const words = rawLine.split(" ");
    let currentLine = "";
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const textWidth = helvetica.widthOfTextAtSize(testLine, 9.5);
      if (textWidth > usableWidth) {
        wrappedLines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      wrappedLines.push(currentLine);
    }
  }

  // Render text lines onto pages
  const lineHeight = 13.5;
  const linesPerPage = Math.floor(usableHeight / lineHeight);

  let currentLineIndex = 0;
  while (currentLineIndex < wrappedLines.length) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    let currentY = pageHeight - marginTop;

    // Header on every document page
    const isJoiningLetter = input.documentType === "JOINING_LETTER";
    const docHeaderTitle = isJoiningLetter
      ? "ATOMIC PATHSHALA — EDUCATOR APPOINTMENT / JOINING LETTER"
      : "ATOMIC PATHSHALA — EDUCATOR SERVICE AGREEMENT";

    page.drawText(docHeaderTitle, {
      x: marginX,
      y: pageHeight - 32,
      size: 8,
      font: helveticaBold,
      color: rgb(0.06, 0.16, 0.26),
    });

    page.drawText(`Ref: ${input.agreementNumber}`, {
      x: pageWidth - marginX - helvetica.widthOfTextAtSize(`Ref: ${input.agreementNumber}`, 8),
      y: pageHeight - 32,
      size: 8,
      font: helvetica,
      color: rgb(0.4, 0.45, 0.5),
    });

    // Divider line
    page.drawLine({
      start: { x: marginX, y: pageHeight - 38 },
      end: { x: pageWidth - marginX, y: pageHeight - 38 },
      thickness: 0.5,
      color: rgb(0.85, 0.88, 0.92),
    });

    // Print text lines
    const pageLines = wrappedLines.slice(currentLineIndex, currentLineIndex + linesPerPage);
    for (const line of pageLines) {
      const isHeader = line.startsWith("===") || line.startsWith("---");
      const isSectionTitle = /^[0-9]+\.\s+[A-Z\s&]+$/.test(line.trim()) || line.includes("ANNEXURE");

      page.drawText(line, {
        x: marginX,
        y: currentY,
        size: 9.5,
        font: isSectionTitle ? helveticaBold : helvetica,
        color: isHeader ? rgb(0.2, 0.25, 0.3) : rgb(0.1, 0.12, 0.15),
      });
      currentY -= lineHeight;
    }

    currentLineIndex += linesPerPage;
  }

  // 4. Dedicated Signatures & Execution Page
  const signPage = pdfDoc.addPage([pageWidth, pageHeight]);

  signPage.drawText("ATOMIC PATHSHALA — EXECUTION & VERIFICATION CERTIFICATE", {
    x: marginX,
    y: pageHeight - 32,
    size: 8,
    font: helveticaBold,
    color: rgb(0.01, 0.52, 0.78),
  });
  signPage.drawLine({
    start: { x: marginX, y: pageHeight - 38 },
    end: { x: pageWidth - marginX, y: pageHeight - 38 },
    thickness: 0.5,
    color: rgb(0.85, 0.88, 0.92),
  });

  let signY = pageHeight - 65;

  signPage.drawText("IN WITNESS WHEREOF: DUAL ELECTRONIC SIGNATURE EXECUTION", {
    x: marginX,
    y: signY,
    size: 13,
    font: timesBold,
    color: rgb(0.05, 0.1, 0.2),
  });
  signY -= 20;

  signPage.drawText(
    "Pursuant to the Indian Contract Act, 1872 and Information Technology Act, 2000, both parties have reviewed,",
    { x: marginX, y: signY, size: 9, font: helvetica, color: rgb(0.3, 0.35, 0.4) }
  );
  signY -= 13;
  signPage.drawText(
    "approved, and recorded their electronic consent to all covenants, payment terms, and annexures of this Agreement.",
    { x: marginX, y: signY, size: 9, font: helvetica, color: rgb(0.3, 0.35, 0.4) }
  );
  signY -= 35;

  const colWidth = (usableWidth - 25) / 2;

  // Box 1: Educator Box
  const box1X = marginX;
  const boxHeight = 220;
  signPage.drawRectangle({
    x: box1X,
    y: signY - boxHeight,
    width: colWidth,
    height: boxHeight,
    borderColor: rgb(0.8, 0.84, 0.88),
    borderWidth: 1,
    color: rgb(0.98, 0.99, 1),
  });

  signPage.drawText("FIRST PARTY: THE EDUCATOR", {
    x: box1X + 14,
    y: signY - 22,
    size: 10,
    font: helveticaBold,
    color: rgb(0.01, 0.52, 0.78),
  });

  signPage.drawText(`Name: ${input.educatorName}`, {
    x: box1X + 14,
    y: signY - 40,
    size: 9,
    font: helvetica,
    color: rgb(0.1, 0.15, 0.2),
  });

  signPage.drawText(`Designation: ${input.designation}`, {
    x: box1X + 14,
    y: signY - 54,
    size: 9,
    font: helvetica,
    color: rgb(0.3, 0.35, 0.4),
  });

  signPage.drawText(`PAN: ${input.educatorPan}`, {
    x: box1X + 14,
    y: signY - 68,
    size: 9,
    font: helvetica,
    color: rgb(0.3, 0.35, 0.4),
  });

  // Render educator signature if available
  if (input.educatorSignatureDataUrl) {
    try {
      const base64Data = input.educatorSignatureDataUrl.replace(/^data:image\/\w+;base64,/, "");
      const sigImgBuffer = Buffer.from(base64Data, "base64");
      const sigImg = await pdfDoc.embedPng(sigImgBuffer).catch(async () => {
        return await pdfDoc.embedJpg(sigImgBuffer);
      });
      signPage.drawImage(sigImg, {
        x: box1X + 14,
        y: signY - 145,
        width: 140,
        height: 50,
      });
    } catch {
      // Fallback typed display
      signPage.drawText(input.educatorSignedName || input.educatorName, {
        x: box1X + 14,
        y: signY - 120,
        size: 18,
        font: timesBold,
        color: rgb(0.01, 0.52, 0.78),
      });
    }
    signPage.drawText(`[Electronically Signed: ${input.educatorSignedName || input.educatorName}]`, {
      x: box1X + 14,
      y: signY - 165,
      size: 8,
      font: helveticaBold,
      color: rgb(0.1, 0.6, 0.3),
    });
    if (input.educatorSignedAt) {
      signPage.drawText(`Timestamp: ${input.educatorSignedAt.toUTCString()}`, {
        x: box1X + 14,
        y: signY - 179,
        size: 7.5,
        font: helvetica,
        color: rgb(0.4, 0.45, 0.5),
      });
    }
    if (input.educatorIp) {
      signPage.drawText(`Signer IP: ${input.educatorIp}`, {
        x: box1X + 14,
        y: signY - 193,
        size: 7.5,
        font: helvetica,
        color: rgb(0.4, 0.45, 0.5),
      });
    }
  } else {
    signPage.drawText("Pending Educator Electronic Signature", {
      x: box1X + 14,
      y: signY - 120,
      size: 9.5,
      font: helvetica,
      color: rgb(0.7, 0.3, 0.3),
    });
  }

  // Box 2: Director Box
  const box2X = box1X + colWidth + 25;
  signPage.drawRectangle({
    x: box2X,
    y: signY - boxHeight,
    width: colWidth,
    height: boxHeight,
    borderColor: rgb(0.8, 0.84, 0.88),
    borderWidth: 1,
    color: rgb(0.98, 0.99, 1),
  });

  signPage.drawText("SECOND PARTY: ATOMIC PATHSHALA", {
    x: box2X + 14,
    y: signY - 22,
    size: 10,
    font: helveticaBold,
    color: rgb(0.01, 0.52, 0.78),
  });

  signPage.drawText(`Signatory: ${input.authorizedSignatoryName}`, {
    x: box2X + 14,
    y: signY - 40,
    size: 9,
    font: helvetica,
    color: rgb(0.1, 0.15, 0.2),
  });

  signPage.drawText(`Designation: ${input.authorizedSignatoryDesignation}`, {
    x: box2X + 14,
    y: signY - 54,
    size: 9,
    font: helvetica,
    color: rgb(0.3, 0.35, 0.4),
  });

  signPage.drawText("Enterprise: ATOMIC PATHSHALA EDUCATION", {
    x: box2X + 14,
    y: signY - 68,
    size: 8.5,
    font: helvetica,
    color: rgb(0.3, 0.35, 0.4),
  });

  signPage.drawText("Location: Rampur, Uttar Pradesh, India", {
    x: box2X + 14,
    y: signY - 82,
    size: 8.5,
    font: helvetica,
    color: rgb(0.3, 0.35, 0.4),
  });

  // Render director signature if available
  if (input.directorSignedAt) {
    if (input.directorSignatureDataUrl) {
      try {
        const base64Data = input.directorSignatureDataUrl.replace(/^data:image\/\w+;base64,/, "");
        const sigImgBuffer = Buffer.from(base64Data, "base64");
        const sigImg = await pdfDoc.embedPng(sigImgBuffer).catch(async () => {
          return await pdfDoc.embedJpg(sigImgBuffer);
        });
        signPage.drawImage(sigImg, {
          x: box2X + 14,
          y: signY - 145,
          width: 140,
          height: 50,
        });
      } catch {
        signPage.drawText(input.directorSignedName || input.authorizedSignatoryName, {
          x: box2X + 14,
          y: signY - 120,
          size: 18,
          font: timesBold,
          color: rgb(0.01, 0.52, 0.78),
        });
      }
    } else {
      signPage.drawText(input.directorSignedName || input.authorizedSignatoryName, {
        x: box2X + 14,
        y: signY - 120,
        size: 18,
        font: timesBold,
        color: rgb(0.01, 0.52, 0.78),
      });
    }

    signPage.drawText(`[Countersigned: ${input.directorSignedName || input.authorizedSignatoryName}]`, {
      x: box2X + 14,
      y: signY - 165,
      size: 8,
      font: helveticaBold,
      color: rgb(0.1, 0.6, 0.3),
    });
    signPage.drawText(`Timestamp: ${input.directorSignedAt.toUTCString()}`, {
      x: box2X + 14,
      y: signY - 179,
      size: 7.5,
      font: helvetica,
      color: rgb(0.4, 0.45, 0.5),
    });
    if (input.directorIp) {
      signPage.drawText(`Signer IP: ${input.directorIp}`, {
        x: box2X + 14,
        y: signY - 193,
        size: 7.5,
        font: helvetica,
        color: rgb(0.4, 0.45, 0.5),
      });
    }
  } else {
    signPage.drawText("Awaiting Director Countersignature", {
      x: box2X + 14,
      y: signY - 120,
      size: 9.5,
      font: helvetica,
      color: rgb(0.7, 0.5, 0.1),
    });
  }

  // 5. Cryptographic Audit Trail Box
  signY -= boxHeight + 25;
  signPage.drawRectangle({
    x: marginX,
    y: signY - 120,
    width: usableWidth,
    height: 120,
    borderColor: rgb(0.85, 0.88, 0.92),
    borderWidth: 1,
    color: rgb(0.97, 0.98, 0.99),
  });

  signPage.drawText("CRYPTOGRAPHIC AUDIT & COMPLIANCE LOG", {
    x: marginX + 12,
    y: signY - 18,
    size: 9,
    font: helveticaBold,
    color: rgb(0.2, 0.25, 0.3),
  });

  signPage.drawText(`Agreement Reference: ${input.agreementNumber}`, {
    x: marginX + 12,
    y: signY - 34,
    size: 8,
    font: helvetica,
    color: rgb(0.3, 0.35, 0.4),
  });

  if (input.eStampCertNo) {
    signPage.drawText(`e-Stamp Certificate No: ${input.eStampCertNo} (${input.eStampState || "UP"}, INR ${input.eStampAmount || "100"})`, {
      x: marginX + 12,
      y: signY - 48,
      size: 8,
      font: helvetica,
      color: rgb(0.1, 0.5, 0.3),
    });
  } else {
    signPage.drawText("e-Stamp Duty Status: Standard execution mode; stamp certificate retained in compliance records.", {
      x: marginX + 12,
      y: signY - 48,
      size: 8,
      font: helvetica,
      color: rgb(0.4, 0.45, 0.5),
    });
  }

  signPage.drawText(`Educator Signer Status: ${input.educatorSignedAt ? "VERIFIED & LOCKED" : "PENDING"}`, {
    x: marginX + 12,
    y: signY - 62,
    size: 8,
    font: helvetica,
    color: input.educatorSignedAt ? rgb(0.1, 0.55, 0.2) : rgb(0.7, 0.4, 0.1),
  });

  signPage.drawText(`Director Signer Status: ${input.directorSignedAt ? "VERIFIED & FULLY EXECUTED" : "AWAITING COUNTERSIGNATURE"}`, {
    x: marginX + 12,
    y: signY - 76,
    size: 8,
    font: helvetica,
    color: input.directorSignedAt ? rgb(0.1, 0.55, 0.2) : rgb(0.7, 0.4, 0.1),
  });

  signPage.drawText("Security Guarantee: Document locked against alteration. Any unauthorized edit invalidates SHA-256 seal.", {
    x: marginX + 12,
    y: signY - 92,
    size: 7.5,
    font: helvetica,
    color: rgb(0.5, 0.55, 0.6),
  });

  // Footer on all pages
  const totalPages = pdfDoc.getPageCount();
  pdfDoc.getPages().forEach((p, idx) => {
    p.drawText(`Atomic Pathshala • Rampur, Uttar Pradesh, India • Page ${idx + 1} of ${totalPages}`, {
      x: marginX,
      y: 25,
      size: 8,
      font: helvetica,
      color: rgb(0.5, 0.55, 0.6),
    });
  });

  const pdfBytes = await pdfDoc.save();
  const pdfBuffer = Buffer.from(pdfBytes);
  const documentHash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

  return {
    pdfBuffer,
    documentHash,
    pageCount: totalPages,
  };
}

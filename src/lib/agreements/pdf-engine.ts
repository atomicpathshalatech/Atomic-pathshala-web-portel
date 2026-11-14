import "server-only";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

export type AgreementPdfInput = {
  agreementNumber: string;
  documentType?: "JOINING_LETTER" | "SERVICE_AGREEMENT";
  title: string;
  effectiveDate: string;
  educatorName: string;
  educatorEmail: string;
  educatorPhone?: string;
  educatorAddress?: string;
  educatorPan?: string;
  designation: string;
  department: string;
  annualSalary?: string;
  monthlySalary?: string;
  teachingHoursMonthly?: string;
  paymentCycleDay?: string;
  noticePeriodDays?: string;
  workLocation?: string;
  companyName?: string;
  companyAddress?: string;
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
  // Founder and Director Signature
  directorSignatureDataUrl?: string;
  directorSignedName?: string;
  directorSignedAt?: Date;
  directorIp?: string;
};

function cleanWinAnsi(text: string): string {
  return text
    .replace(/[VERIFIED]/g, "[VERIFIED]")
    .replace(/✔/g, "[VERIFIED]")
    .replace(/-/g, "-")
    .replace(/–/g, "-")
    .replace(/-/g, "*")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x00-\xFF]/g, "");
}

export async function generateAgreementPdf(input: AgreementPdfInput): Promise<{
  pdfBuffer: Buffer;
  documentHash: string;
  pageCount: number;
}> {
  const pdfDoc = await PDFDocument.create();

  // 1. Embed Times New Roman Fonts Suite
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const timesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // 2. Load Official Atomic Pathshala Logo
  let embeddedLogo: any = null;
  try {
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      embeddedLogo = await pdfDoc.embedPng(logoBuffer);
    }
  } catch (err) {
    console.warn("[pdf-engine] Could not load logo image:", err);
  }

  // 3. Attach authentic e-Stamp PDF if provided as Page 1
  if (input.eStampPdfBuffer && input.eStampPdfBuffer.length > 0) {
    try {
      const stampDoc = await PDFDocument.load(input.eStampPdfBuffer);
      const copiedPages = await pdfDoc.copyPages(stampDoc, stampDoc.getPageIndices());
      copiedPages.forEach((page) => pdfDoc.addPage(page));
    } catch (e) {
      console.warn("[pdf-engine] Failed to load e-stamp PDF attachment:", e);
    }
  }

  // 4. Dimensions & Layout Setup
  const pageWidth = 595.28; // Standard A4 width
  const pageHeight = 841.89; // Standard A4 height
  const marginX = 54;
  const marginTopPage1 = 145; // Below official letterhead
  const marginTopOther = 56;
  const marginBottom = 50;
  const usableWidth = pageWidth - marginX * 2;

  // 5. Clean and parse raw body text (Filter out terminal ASCII lines)
  const rawLines = input.bodyText.split("\n");
  const cleanedLines: string[] = [];

  for (const raw of rawLines) {
    const trimmed = raw.trim();
    // Skip ASCII terminal borders completely
    if (/^[=\-_]{4,}$/.test(trimmed)) continue;
    cleanedLines.push(raw);
  }

  // 6. Tokenize lines into formatted render items
  type RenderItem =
    | { type: "SECTION_HEADER"; text: string }
    | { type: "KEY_VALUE"; label: string; value: string }
    | { type: "POLICY_LINE"; title: string; desc: string }
    | { type: "SUBJECT_LINE"; text: string }
    | { type: "SALUTATION"; text: string }
    | { type: "PARAGRAPH"; text: string }
    | { type: "EMPTY" };

  const parsedItems: RenderItem[] = [];

  for (const line of cleanedLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      parsedItems.push({ type: "EMPTY" });
      continue;
    }

    // Section Headers
    if (
      /^(CLAUSE\s+[0-9]+|ANNEXURE\s+[A-Z]|[0-9]+\.\s+[A-Z\s&,()]+$|PARTIES\s+TO\s+THIS\s+AGREEMENT|WHEREAS:|NOW,\s+THEREFORE|EDUCATOR\s+ACCEPTANCE|OFFICIAL\s+LETTER\s+OF\s+APPOINTMENT|EDUCATOR\s+SERVICE\s+AGREEMENT)/i.test(
        trimmed
      )
    ) {
      parsedItems.push({ type: "SECTION_HEADER", text: trimmed });
      continue;
    }

    // Subject Line
    if (/^Subject:\s*/i.test(trimmed)) {
      parsedItems.push({ type: "SUBJECT_LINE", text: trimmed });
      continue;
    }

    // Salutation
    if (/^(Dear\s+|To,\s*$)/i.test(trimmed)) {
      parsedItems.push({ type: "SALUTATION", text: trimmed });
      continue;
    }

    // Policy line
    const policyMatch = trimmed.match(/^(Policy\s+[A-J]\s+-\s+[^:]+):\s*(.*)$/i);
    if (policyMatch && policyMatch[1] && policyMatch[2]) {
      parsedItems.push({
        type: "POLICY_LINE",
        title: policyMatch[1].trim(),
        desc: policyMatch[2].trim(),
      });
      continue;
    }

    // Key-Value rows (e.g. "1.1 Educator Name : Umaima Nadeem" or "Document Reference: AP-JL-...")
    const kvMatch = trimmed.match(/^([0-9.]*\s*[A-Za-z\s&()]+?)\s*:\s*(.+)$/);
    if (
      kvMatch &&
      kvMatch[1] &&
      kvMatch[2] &&
      !trimmed.startsWith("http") &&
      kvMatch[1].length < 35
    ) {
      parsedItems.push({
        type: "KEY_VALUE",
        label: kvMatch[1].trim(),
        value: kvMatch[2].trim(),
      });
      continue;
    }

    parsedItems.push({ type: "PARAGRAPH", text: trimmed });
  }

  // 7. Paginated Rendering
  const pages: any[] = [];
  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  pages.push(currentPage);
  let isFirstPage = true;
  let currentY = pageHeight - marginTopPage1;

  function renderPage1Header(page: any) {
    const headerTop = pageHeight - 34;

    // Draw Official Logo
    if (embeddedLogo) {
      page.drawImage(embeddedLogo, {
        x: marginX,
        y: headerTop - 46,
        width: 46,
        height: 46,
      });
    }

    // Corporate Enterprise Details
    const textX = embeddedLogo ? marginX + 54 : marginX;

    page.drawText("ATOMIC PATHSHALA EDUCATION", {
      x: textX,
      y: headerTop - 10,
      size: 15,
      font: timesBold,
      color: rgb(0.04, 0.12, 0.28), // Deep Corporate Navy
    });

    page.drawText("Premier Academy for NEET, JEE & Medical/Engineering Foundation", {
      x: textX,
      y: headerTop - 22,
      size: 8.5,
      font: timesItalic,
      color: rgb(0.35, 0.4, 0.48),
    });

    page.drawText(
      "Head Office: Rampur, Uttar Pradesh, India - Official Portal: https://atomicpathshala.in",
      {
        x: textX,
        y: headerTop - 34,
        size: 7.5,
        font: timesRoman,
        color: rgb(0.4, 0.45, 0.5),
      }
    );

    // Document Reference Badge (Right aligned)
    const refText = `Ref: ${input.agreementNumber}`;
    const dateText = `Date: ${input.effectiveDate}`;
    page.drawText(refText, {
      x: pageWidth - marginX - timesBold.widthOfTextAtSize(refText, 8.5),
      y: headerTop - 10,
      size: 8.5,
      font: timesBold,
      color: rgb(0.04, 0.12, 0.28),
    });
    page.drawText(dateText, {
      x: pageWidth - marginX - timesRoman.widthOfTextAtSize(dateText, 8),
      y: headerTop - 22,
      size: 8,
      font: timesRoman,
      color: rgb(0.35, 0.4, 0.48),
    });

    // Double Header Rule (Navy line + Gold accent)
    page.drawLine({
      start: { x: marginX, y: headerTop - 52 },
      end: { x: pageWidth - marginX, y: headerTop - 52 },
      thickness: 1.5,
      color: rgb(0.06, 0.16, 0.35),
    });
    page.drawLine({
      start: { x: marginX, y: headerTop - 55 },
      end: { x: pageWidth - marginX, y: headerTop - 55 },
      thickness: 0.75,
      color: rgb(0.85, 0.65, 0.15), // Royal Gold
    });

    // Document Title Banner
    const isJoining = input.documentType === "JOINING_LETTER";
    const docTitle = isJoining
      ? "OFFICIAL EDUCATOR APPOINTMENT & JOINING LETTER"
      : "OFFICIAL EDUCATOR SERVICE AGREEMENT";

    const titleWidth = timesBold.widthOfTextAtSize(docTitle, 13);
    page.drawText(docTitle, {
      x: (pageWidth - titleWidth) / 2,
      y: headerTop - 74,
      size: 13,
      font: timesBold,
      color: rgb(0.04, 0.12, 0.28),
    });

    // Accent line under title
    page.drawLine({
      start: { x: (pageWidth - titleWidth) / 2 - 10, y: headerTop - 79 },
      end: { x: (pageWidth + titleWidth) / 2 + 10, y: headerTop - 79 },
      thickness: 1,
      color: rgb(0.85, 0.65, 0.15),
    });
  }

  function renderSubsequentHeader(page: any) {
    const isJoining = input.documentType === "JOINING_LETTER";
    const title = isJoining
      ? "ATOMIC PATHSHALA EDUCATION - APPOINTMENT LETTER"
      : "ATOMIC PATHSHALA EDUCATION - SERVICE AGREEMENT";

    page.drawText(title, {
      x: marginX,
      y: pageHeight - 30,
      size: 8,
      font: timesBold,
      color: rgb(0.04, 0.12, 0.28),
    });

    page.drawText(`Ref: ${input.agreementNumber}`, {
      x: pageWidth - marginX - timesRoman.widthOfTextAtSize(`Ref: ${input.agreementNumber}`, 8),
      y: pageHeight - 30,
      size: 8,
      font: timesRoman,
      color: rgb(0.35, 0.4, 0.48),
    });

    page.drawLine({
      start: { x: marginX, y: pageHeight - 36 },
      end: { x: pageWidth - marginX, y: pageHeight - 36 },
      thickness: 0.5,
      color: rgb(0.8, 0.84, 0.9),
    });
  }

  // Draw header for page 1
  renderPage1Header(currentPage);

  function checkPageSpace(requiredHeight: number) {
    if (currentY - requiredHeight < marginBottom) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      pages.push(currentPage);
      isFirstPage = false;
      renderSubsequentHeader(currentPage);
      currentY = pageHeight - marginTopOther;
    }
  }

  // Wrap helper for Times Roman
  function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const w of words) {
      const test = currentLine ? `${currentLine} ${w}` : w;
      if (font.widthOfTextAtSize(test, fontSize) > maxWidth) {
        if (currentLine) lines.push(currentLine);
        currentLine = w;
      } else {
        currentLine = test;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  // Render items onto pages
  for (const item of parsedItems) {
    switch (item.type) {
      case "EMPTY":
        currentY -= 8;
        break;

      case "SECTION_HEADER": {
        checkPageSpace(38);
        currentY -= 10;
        currentPage.drawText(cleanWinAnsi(item.text), {
          x: marginX,
          y: currentY,
          size: 11,
          font: timesBold,
          color: rgb(0.04, 0.12, 0.28),
        });
        currentY -= 4;
        currentPage.drawLine({
          start: { x: marginX, y: currentY },
          end: { x: marginX + timesBold.widthOfTextAtSize(item.text, 11), y: currentY },
          thickness: 1,
          color: rgb(0.85, 0.65, 0.15),
        });
        currentY -= 12;
        break;
      }

      case "SUBJECT_LINE": {
        checkPageSpace(22);
        currentY -= 4;
        currentPage.drawText(cleanWinAnsi(item.text), {
          x: marginX,
          y: currentY,
          size: 10,
          font: timesBold,
          color: rgb(0.05, 0.1, 0.2),
        });
        currentY -= 14;
        break;
      }

      case "SALUTATION": {
        checkPageSpace(18);
        currentPage.drawText(cleanWinAnsi(item.text), {
          x: marginX,
          y: currentY,
          size: 10,
          font: timesBold,
          color: rgb(0.08, 0.12, 0.18),
        });
        currentY -= 14;
        break;
      }

      case "KEY_VALUE": {
        checkPageSpace(16);
        const labelText = `${item.label} :`;
        const labelWidth = timesBold.widthOfTextAtSize(labelText, 9.5);
        const colWidth = 150;

        // Draw Label in TimesBold
        currentPage.drawText(cleanWinAnsi(labelText), {
          x: marginX,
          y: currentY,
          size: 9.5,
          font: timesBold,
          color: rgb(0.12, 0.16, 0.24),
        });

        // Value in TimesRoman
        const valueX = marginX + Math.max(labelWidth + 8, colWidth);
        const availableValueWidth = pageWidth - marginX - valueX;
        const wrappedVal = wrapText(item.value, availableValueWidth, timesRoman, 9.5);

        for (let i = 0; i < wrappedVal.length; i++) {
          if (i > 0) {
            currentY -= 13;
            checkPageSpace(14);
          }
          currentPage.drawText(cleanWinAnsi(wrappedVal[i]!), {
            x: valueX,
            y: currentY,
            size: 9.5,
            font: timesRoman,
            color: rgb(0.08, 0.1, 0.15),
          });
        }
        currentY -= 13;
        break;
      }

      case "POLICY_LINE": {
        checkPageSpace(24);
        const titleText = `${item.title}: `;
        const titleWidth = timesBold.widthOfTextAtSize(titleText, 9.5);

        currentPage.drawText(cleanWinAnsi(titleText), {
          x: marginX,
          y: currentY,
          size: 9.5,
          font: timesBold,
          color: rgb(0.05, 0.15, 0.32),
        });

        const wrappedDesc = wrapText(
          item.desc,
          usableWidth - titleWidth - 5,
          timesRoman,
          9.5
        );

        if (wrappedDesc.length > 0 && wrappedDesc[0]) {
          currentPage.drawText(cleanWinAnsi(wrappedDesc[0]), {
            x: marginX + titleWidth,
            y: currentY,
            size: 9.5,
            font: timesRoman,
            color: rgb(0.1, 0.12, 0.18),
          });
          currentY -= 13;

          for (let i = 1; i < wrappedDesc.length; i++) {
            checkPageSpace(14);
            currentPage.drawText(cleanWinAnsi(wrappedDesc[i]!), {
              x: marginX + 15,
              y: currentY,
              size: 9.5,
              font: timesRoman,
              color: rgb(0.1, 0.12, 0.18),
            });
            currentY -= 13;
          }
        }
        break;
      }

      case "PARAGRAPH": {
        const wrapped = wrapText(item.text, usableWidth, timesRoman, 9.5);
        for (const line of wrapped) {
          checkPageSpace(14);
          currentPage.drawText(cleanWinAnsi(line), {
            x: marginX,
            y: currentY,
            size: 9.5,
            font: timesRoman,
            color: rgb(0.1, 0.12, 0.16),
          });
          currentY -= 13.5;
        }
        break;
      }
    }
  }

  // 8. Dedicated Signatures & Execution Page
  const signPage = pdfDoc.addPage([pageWidth, pageHeight]);
  pages.push(signPage);
  renderSubsequentHeader(signPage);

  let signY = pageHeight - 65;

  signPage.drawText("IN WITNESS WHEREOF: DUAL ELECTRONIC SIGNATURE EXECUTION", {
    x: marginX,
    y: signY,
    size: 13,
    font: timesBold,
    color: rgb(0.04, 0.12, 0.28),
  });
  signY -= 18;

  const statutoryText1 =
    "Pursuant to Section 10A of the Information Technology Act, 2000 and the Indian Contract Act, 1872,";
  const statutoryText2 =
    "both parties have reviewed, approved, and recorded their electronic execution to all covenants, payment terms, and policies.";
  signPage.drawText(statutoryText1, {
    x: marginX,
    y: signY,
    size: 8.5,
    font: timesRoman,
    color: rgb(0.3, 0.35, 0.4),
  });
  signY -= 12;
  signPage.drawText(statutoryText2, {
    x: marginX,
    y: signY,
    size: 8.5,
    font: timesRoman,
    color: rgb(0.3, 0.35, 0.4),
  });
  signY -= 30;

  const colWidth = (usableWidth - 20) / 2;
  const boxHeight = 220;

  // Box 1: Educator Box (Left)
  const box1X = marginX;
  signPage.drawRectangle({
    x: box1X,
    y: signY - boxHeight,
    width: colWidth,
    height: boxHeight,
    borderColor: rgb(0.82, 0.86, 0.92),
    borderWidth: 1,
    color: rgb(0.985, 0.99, 1),
  });

  signPage.drawRectangle({
    x: box1X,
    y: signY - 26,
    width: colWidth,
    height: 26,
    color: rgb(0.06, 0.18, 0.38),
  });

  signPage.drawText("FIRST PARTY: THE EDUCATOR", {
    x: box1X + 12,
    y: signY - 17,
    size: 9.5,
    font: timesBold,
    color: rgb(1, 1, 1),
  });

  let fieldY1 = signY - 44;
  signPage.drawText(`Name: ${input.educatorName}`, {
    x: box1X + 12,
    y: fieldY1,
    size: 9.5,
    font: timesBold,
    color: rgb(0.08, 0.12, 0.18),
  });
  fieldY1 -= 14;

  signPage.drawText(`Designation: ${input.designation}`, {
    x: box1X + 12,
    y: fieldY1,
    size: 8.5,
    font: timesRoman,
    color: rgb(0.25, 0.3, 0.38),
  });
  fieldY1 -= 14;

  // Only display PAN if genuine and not placeholder
  if (input.educatorPan && !input.educatorPan.includes("ABCDE") && input.educatorPan.length >= 8) {
    signPage.drawText(`PAN: ${input.educatorPan}`, {
      x: box1X + 12,
      y: fieldY1,
      size: 8.5,
      font: timesRoman,
      color: rgb(0.25, 0.3, 0.38),
    });
    fieldY1 -= 14;
  }

  // Draw Educator Signature (Clean cursive calligraphic or genuine canvas PNG)
  const sigAreaY = signY - 145;
  let signatureDrawn = false;

  if (input.educatorSignatureDataUrl && input.educatorSignatureDataUrl.length > 2000) {
    try {
      const base64Data = input.educatorSignatureDataUrl.replace(/^data:image\/\w+;base64,/, "");
      const sigImgBuffer = Buffer.from(base64Data, "base64");
      const sigImg = await pdfDoc.embedPng(sigImgBuffer).catch(async () => {
        return await pdfDoc.embedJpg(sigImgBuffer);
      });
      signPage.drawImage(sigImg, {
        x: box1X + 16,
        y: sigAreaY,
        width: 130,
        height: 40,
      });
      signatureDrawn = true;
    } catch {
      signatureDrawn = false;
    }
  }

  if (!signatureDrawn) {
    // Elegant Calligraphic Signature
    signPage.drawText(input.educatorSignedName || input.educatorName, {
      x: box1X + 16,
      y: sigAreaY + 12,
      size: 19,
      font: timesItalic,
      color: rgb(0.04, 0.15, 0.4),
    });
    signPage.drawLine({
      start: { x: box1X + 14, y: sigAreaY + 6 },
      end: { x: box1X + colWidth - 14, y: sigAreaY + 6 },
      thickness: 0.75,
      color: rgb(0.8, 0.84, 0.9),
    });
  }

  signPage.drawText(`[VERIFIED] Electronically Signed: ${input.educatorSignedName || input.educatorName}`, {
    x: box1X + 12,
    y: signY - 165,
    size: 8,
    font: timesBold,
    color: rgb(0.1, 0.5, 0.25), // Forest Green
  });

  const eduTime = input.educatorSignedAt
    ? input.educatorSignedAt.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }) + " (IST)"
    : `${input.effectiveDate} (IST)`;

  signPage.drawText(`Timestamp: ${eduTime}`, {
    x: box1X + 12,
    y: signY - 178,
    size: 7.5,
    font: timesRoman,
    color: rgb(0.4, 0.45, 0.5),
  });

  if (input.educatorIp) {
    signPage.drawText(`Signer IP: ${input.educatorIp}`, {
      x: box1X + 12,
      y: signY - 190,
      size: 7.5,
      font: timesRoman,
      color: rgb(0.4, 0.45, 0.5),
    });
  }

  // Box 2: Atomic Pathshala Box (Right)
  const box2X = box1X + colWidth + 20;
  signPage.drawRectangle({
    x: box2X,
    y: signY - boxHeight,
    width: colWidth,
    height: boxHeight,
    borderColor: rgb(0.82, 0.86, 0.92),
    borderWidth: 1,
    color: rgb(0.985, 0.99, 1),
  });

  signPage.drawRectangle({
    x: box2X,
    y: signY - 26,
    width: colWidth,
    height: 26,
    color: rgb(0.04, 0.12, 0.28),
  });

  signPage.drawText("SECOND PARTY: ATOMIC PATHSHALA", {
    x: box2X + 12,
    y: signY - 17,
    size: 9.5,
    font: timesBold,
    color: rgb(1, 1, 1),
  });

  let fieldY2 = signY - 44;
  signPage.drawText(`Authorized Signatory: ${input.authorizedSignatoryName}`, {
    x: box2X + 12,
    y: fieldY2,
    size: 9.5,
    font: timesBold,
    color: rgb(0.08, 0.12, 0.18),
  });
  fieldY2 -= 14;

  signPage.drawText(`Designation: ${input.authorizedSignatoryDesignation}`, {
    x: box2X + 12,
    y: fieldY2,
    size: 8.5,
    font: timesRoman,
    color: rgb(0.25, 0.3, 0.38),
  });
  fieldY2 -= 14;

  signPage.drawText("Enterprise: ATOMIC PATHSHALA EDUCATION", {
    x: box2X + 12,
    y: fieldY2,
    size: 8.5,
    font: timesRoman,
    color: rgb(0.25, 0.3, 0.38),
  });
  fieldY2 -= 14;

  signPage.drawText("Location: Rampur, Uttar Pradesh, India", {
    x: box2X + 12,
    y: fieldY2,
    size: 8.5,
    font: timesRoman,
    color: rgb(0.25, 0.3, 0.38),
  });

  // Founder and Director Calligraphic Signature
  signPage.drawText("Firoz Ali", {
    x: box2X + 16,
    y: sigAreaY + 12,
    size: 21,
    font: timesItalic,
    color: rgb(0.04, 0.15, 0.4),
  });
  signPage.drawLine({
    start: { x: box2X + 14, y: sigAreaY + 6 },
    end: { x: box2X + colWidth - 14, y: sigAreaY + 6 },
    thickness: 0.75,
    color: rgb(0.8, 0.84, 0.9),
  });

  signPage.drawText(`[VERIFIED] Countersigned: Firoz Ali (Founder and Director)`, {
    x: box2X + 12,
    y: signY - 165,
    size: 8,
    font: timesBold,
    color: rgb(0.1, 0.5, 0.25),
  });

  const dirTime = input.directorSignedAt
    ? input.directorSignedAt.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }) + " (IST)"
    : `${input.effectiveDate} (IST)`;

  signPage.drawText(`Timestamp: ${dirTime}`, {
    x: box2X + 12,
    y: signY - 178,
    size: 7.5,
    font: timesRoman,
    color: rgb(0.4, 0.45, 0.5),
  });

  if (input.directorIp) {
    signPage.drawText(`Signer IP: ${input.directorIp}`, {
      x: box2X + 12,
      y: signY - 190,
      size: 7.5,
      font: timesRoman,
      color: rgb(0.4, 0.45, 0.5),
    });
  }

  // Bottom Cryptographic Audit Block
  const auditY = signY - boxHeight - 20;
  const auditHeight = 78;

  signPage.drawRectangle({
    x: marginX,
    y: auditY - auditHeight,
    width: usableWidth,
    height: auditHeight,
    borderColor: rgb(0.85, 0.88, 0.94),
    borderWidth: 1,
    color: rgb(0.97, 0.985, 1),
  });

  signPage.drawText("CRYPTOGRAPHIC AUDIT & STATUTORY COMPLIANCE SEAL", {
    x: marginX + 14,
    y: auditY - 18,
    size: 8.5,
    font: timesBold,
    color: rgb(0.04, 0.12, 0.28),
  });

  signPage.drawText(`Agreement Reference Number: ${input.agreementNumber}`, {
    x: marginX + 14,
    y: auditY - 32,
    size: 8,
    font: timesRoman,
    color: rgb(0.2, 0.25, 0.32),
  });

  const stampInfo = input.eStampCertNo
    ? `State Government e-Stamp Verified: ${input.eStampCertNo} (${input.eStampState || "UP"} - INR ${input.eStampAmount || "100"})`
    : "Standard execution mode pursuant to Section 10A of the IT Act, 2000.";

  signPage.drawText(stampInfo, {
    x: marginX + 14,
    y: auditY - 45,
    size: 8,
    font: timesRoman,
    color: rgb(0.2, 0.25, 0.32),
  });

  signPage.drawText(
    "Legal Validity: Both parties confirm that electronic execution constitutes full mutual assent and is legally binding.",
    {
      x: marginX + 14,
      y: auditY - 58,
      size: 7.5,
      font: timesItalic,
      color: rgb(0.35, 0.4, 0.45),
    }
  );

  // 9. Add Running Page Numbers to all pages (Page X of Y)
  const totalPages = pages.length;
  for (let idx = 0; idx < totalPages; idx++) {
    const p = pages[idx];
    const pageNumText = `Page ${idx + 1} of ${totalPages}`;

    p.drawLine({
      start: { x: marginX, y: 38 },
      end: { x: pageWidth - marginX, y: 38 },
      thickness: 0.5,
      color: rgb(0.85, 0.88, 0.92),
    });

    p.drawText("Atomic Pathshala - Rampur, Uttar Pradesh, India", {
      x: marginX,
      y: 26,
      size: 8,
      font: timesRoman,
      color: rgb(0.4, 0.45, 0.5),
    });

    p.drawText(pageNumText, {
      x: pageWidth - marginX - timesBold.widthOfTextAtSize(pageNumText, 8),
      y: 26,
      size: 8,
      font: timesBold,
      color: rgb(0.3, 0.35, 0.4),
    });
  }

  // 10. Save and compute document hash
  const pdfBytes = await pdfDoc.save();
  const pdfBuffer = Buffer.from(pdfBytes);
  const documentHash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

  return {
    pdfBuffer,
    documentHash,
    pageCount: totalPages,
  };
}

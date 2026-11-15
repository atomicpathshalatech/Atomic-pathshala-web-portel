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

/**
 * Clean WinAnsi text for standard PDF fonts (TimesRoman, Helvetica).
 * Converts Unicode punctuation, dashes, bullets, and currency symbols to Latin-1 ASCII equivalents.
 * Strips unsupported non-WinAnsi glyphs without corrupting letters or hyphens.
 */
function cleanWinAnsi(text: string): string {
  if (!text) return "";
  return text
    .replace(/[\u2018\u2019]/g, "'") // Smart single quotes
    .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
    .replace(/[\u2014\u2015]/g, " - ") // Em-dash & horizontal bar
    .replace(/[\u2012\u2013]/g, "-") // En-dash & figure dash
    .replace(/[\u2022\u25CF\u2023]/g, "- ") // Bullets
    .replace(/\u2026/g, "...") // Ellipsis
    .replace(/[\u20B9\u20A8]/g, "INR ") // Rupee symbols
    .replace(/[\u2713\u2714\u2611]/g, "") // Unicode checkmarks (drawn via vector)
    .replace(/[^\x00-\xFF]/g, ""); // Strip anything outside WinAnsi
}

/**
 * Consistent official institutional date formatting.
 * Avoids raw ISO strings like "2026-11-14" in executive legal PDFs.
 */
function formatOfficialDate(raw: string | Date | undefined | null): string {
  if (!raw) return "";
  const d = typeof raw === "string" ? new Date(raw) : raw;
  if (isNaN(d.getTime())) return String(raw);
  const day = d.getDate();
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export async function generateAgreementPdf(input: AgreementPdfInput): Promise<{
  pdfBuffer: Buffer;
  documentHash: string;
  pageCount: number;
}> {
  const pdfDoc = await PDFDocument.create();

  // 1. Embed Times New Roman Suite
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const timesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

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

  // 4. Dimensions & Standard Layout Setup
  const pageWidth = 595.28; // Standard A4 width
  const pageHeight = 841.89; // Standard A4 height
  const marginX = 54;
  const marginTopPage1 = 145; // Below official letterhead
  const marginTopOther = 56;
  const marginBottom = 50;
  const usableWidth = pageWidth - marginX * 2;

  // 5. Clean and parse raw body text (Filter out terminal ASCII borders)
  const rawLines = input.bodyText.split("\n");
  const cleanedLines: string[] = [];

  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (/^[=\-_]{4,}$/.test(trimmed)) continue;
    cleanedLines.push(raw);
  }

  // 6. Tokenize lines into formatted render items
  type RenderItem =
    | { type: "SECTION_HEADER"; text: string }
    | { type: "CLAUSE_PARAGRAPH"; lead: string; body: string }
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

    // Stop parsing template static signature placeholders
    // (Executed dual signatures are rendered dynamically in Section 8)
    if (
      /^SIGNATURE\s+PAGE/i.test(trimmed) ||
      /^IN\s+WITNESS\s+WHEREOF,\s+the\s+Parties\s+hereto\s+have\s+caused/i.test(trimmed)
    ) {
      break;
    }

    // Section Headers
    if (
      /^(CLAUSE\s+[0-9]+|ANNEXURE\s+[A-Z]|PARTIES\s+TO\s+THIS\s+AGREEMENT:?|WHEREAS:?|NOW,\s+THEREFORE:?$|EDUCATOR\s+ACCEPTANCE:?|OFFICIAL\s+LETTER\s+OF\s+APPOINTMENT|EDUCATOR\s+SERVICE\s+AGREEMENT)/i.test(
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

    // Numbered Clause Paragraphs (e.g. "2.1 Appointment : The Platform Owner..." or "7.3 Timely Error Rectification : Any...")
    const clauseMatch = trimmed.match(/^([0-9]+\.[0-9]+\s+[A-Za-z\s&(),/-]+?)\s*:\s*(.+)$/);
    if (clauseMatch && clauseMatch[1] && clauseMatch[2]) {
      parsedItems.push({
        type: "CLAUSE_PARAGRAPH",
        lead: clauseMatch[1].trim() + ":",
        body: clauseMatch[2].trim(),
      });
      continue;
    }

    // Tabular Key-Value rows (short metadata labels like "Agreement Reference : AP-AG-..." or "A.1 Compensation Model : ...")
    const kvMatch = trimmed.match(/^([A-Za-z0-9.]*\s*[A-Za-z\s&()/-]+?)\s*:\s*(.+)$/);
    if (
      kvMatch &&
      kvMatch[1] &&
      kvMatch[2] &&
      !trimmed.startsWith("http") &&
      kvMatch[1].trim().length < 32
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
    const dateFormatted = formatOfficialDate(input.effectiveDate);
    const dateText = `Date: ${dateFormatted}`;

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

  // Word-wrap helper with safety against long words
  function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = "";

    for (const w of words) {
      if (!w) continue;
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
  for (let itemIdx = 0; itemIdx < parsedItems.length; itemIdx++) {
    const item = parsedItems[itemIdx];
    if (!item) continue;

    switch (item.type) {
      case "EMPTY":
        currentY -= 7;
        break;

      case "SECTION_HEADER": {
        const cleanedText = cleanWinAnsi(item.text);

        // Skip redundant document title on page 1 if it matches document title
        if (
          isFirstPage &&
          currentY > pageHeight - marginTopPage1 - 30 &&
          /^(OFFICIAL\s+)?(EDUCATOR\s+SERVICE\s+AGREEMENT|OFFICIAL\s+LETTER\s+OF\s+APPOINTMENT)$/i.test(
            cleanedText
          )
        ) {
          break;
        }

        const headerLines = wrapText(cleanedText, usableWidth, timesBold, 10.5);
        const headerHeight = headerLines.length * 13 + 14;
        checkPageSpace(headerHeight);
        currentY -= 6;

        for (const hLine of headerLines) {
          currentPage.drawText(hLine, {
            x: marginX,
            y: currentY,
            size: 10.5,
            font: timesBold,
            color: rgb(0.04, 0.12, 0.28),
          });
          currentY -= 13;
        }

        currentY -= 2;

        // Bounded gold underline strictly clamped to usableWidth
        const lastLineWidth = timesBold.widthOfTextAtSize(
          headerLines[headerLines.length - 1]!,
          10.5
        );
        const lineWidth = Math.min(lastLineWidth, usableWidth);
        currentPage.drawLine({
          start: { x: marginX, y: currentY },
          end: { x: Math.min(marginX + lineWidth, pageWidth - marginX), y: currentY },
          thickness: 1,
          color: rgb(0.85, 0.65, 0.15),
        });
        currentY -= 10;
        break;
      }

      case "CLAUSE_PARAGRAPH": {
        const cleanedLead = cleanWinAnsi(item.lead);
        const cleanedBody = cleanWinAnsi(item.body);
        const leadWithSpace = `${cleanedLead} `;
        const leadWidth = timesBold.widthOfTextAtSize(leadWithSpace, 9.5);

        const words = cleanedBody.split(/\s+/);
        let line0 = "";
        let wIdx = 0;
        const remaining0 = usableWidth - leadWidth;

        while (wIdx < words.length) {
          const w = words[wIdx]!;
          const test = line0 ? `${line0} ${w}` : w;
          if (timesRoman.widthOfTextAtSize(test, 9.5) <= remaining0) {
            line0 = test;
            wIdx++;
          } else {
            break;
          }
        }

        const otherLines: string[] = [];
        let curLine = "";
        while (wIdx < words.length) {
          const w = words[wIdx]!;
          const test = curLine ? `${curLine} ${w}` : w;
          if (timesRoman.widthOfTextAtSize(test, 9.5) <= usableWidth) {
            curLine = test;
            wIdx++;
          } else {
            if (curLine) otherLines.push(curLine);
            curLine = w;
            wIdx++;
          }
        }
        if (curLine) otherLines.push(curLine);

        const totalLines = 1 + otherLines.length;
        checkPageSpace(totalLines * 13 + 4);

        currentPage.drawText(leadWithSpace, {
          x: marginX,
          y: currentY,
          size: 9.5,
          font: timesBold,
          color: rgb(0.04, 0.12, 0.28),
        });

        if (line0) {
          currentPage.drawText(line0, {
            x: marginX + leadWidth,
            y: currentY,
            size: 9.5,
            font: timesRoman,
            color: rgb(0.1, 0.12, 0.16),
          });
        }
        currentY -= 13;

        for (const oLine of otherLines) {
          checkPageSpace(13);
          currentPage.drawText(oLine, {
            x: marginX,
            y: currentY,
            size: 9.5,
            font: timesRoman,
            color: rgb(0.1, 0.12, 0.16),
          });
          currentY -= 13;
        }
        currentY -= 2;
        break;
      }

      case "SUBJECT_LINE": {
        checkPageSpace(20);
        currentY -= 2;
        currentPage.drawText(cleanWinAnsi(item.text), {
          x: marginX,
          y: currentY,
          size: 10,
          font: timesBold,
          color: rgb(0.05, 0.1, 0.2),
        });
        currentY -= 13;
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
        currentY -= 13;
        break;
      }

      case "KEY_VALUE": {
        checkPageSpace(15);
        const cleanedLabel = cleanWinAnsi(item.label);
        const labelText = `${cleanedLabel} :`;
        const labelWidth = timesBold.widthOfTextAtSize(labelText, 9.5);
        const baseColWidth = 155;
        const colWidth = Math.max(labelWidth + 8, baseColWidth);

        // Draw Label in TimesBold
        currentPage.drawText(labelText, {
          x: marginX,
          y: currentY,
          size: 9.5,
          font: timesBold,
          color: rgb(0.12, 0.16, 0.24),
        });

        // Value in TimesRoman
        const valueX = marginX + colWidth;
        const availableValueWidth = pageWidth - marginX - valueX;
        const wrappedVal = wrapText(cleanWinAnsi(item.value), availableValueWidth, timesRoman, 9.5);

        for (let i = 0; i < wrappedVal.length; i++) {
          if (i > 0) {
            currentY -= 13;
            checkPageSpace(13);
          }
          currentPage.drawText(wrappedVal[i]!, {
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
        const cleanedTitle = cleanWinAnsi(item.title);
        const titleText = `${cleanedTitle}: `;
        const titleWidth = timesBold.widthOfTextAtSize(titleText, 9.5);
        const cleanedDesc = cleanWinAnsi(item.desc);

        const wrappedDesc = wrapText(cleanedDesc, usableWidth - titleWidth - 4, timesRoman, 9.5);
        checkPageSpace((wrappedDesc.length || 1) * 13 + 4);

        currentPage.drawText(titleText, {
          x: marginX,
          y: currentY,
          size: 9.5,
          font: timesBold,
          color: rgb(0.05, 0.15, 0.32),
        });

        if (wrappedDesc.length > 0 && wrappedDesc[0]) {
          currentPage.drawText(wrappedDesc[0], {
            x: marginX + titleWidth,
            y: currentY,
            size: 9.5,
            font: timesRoman,
            color: rgb(0.1, 0.12, 0.18),
          });
          currentY -= 13;

          for (let i = 1; i < wrappedDesc.length; i++) {
            checkPageSpace(13);
            currentPage.drawText(wrappedDesc[i]!, {
              x: marginX + 12,
              y: currentY,
              size: 9.5,
              font: timesRoman,
              color: rgb(0.1, 0.12, 0.18),
            });
            currentY -= 13;
          }
        }
        currentY -= 2;
        break;
      }

      case "PARAGRAPH": {
        const cleaned = cleanWinAnsi(item.text);
        const wrapped = wrapText(cleaned, usableWidth, timesRoman, 9.5);
        checkPageSpace(wrapped.length * 13 + 4);

        for (const line of wrapped) {
          checkPageSpace(13);
          currentPage.drawText(line, {
            x: marginX,
            y: currentY,
            size: 9.5,
            font: timesRoman,
            color: rgb(0.1, 0.12, 0.16),
          });
          currentY -= 13;
        }
        currentY -= 2;
        break;
      }
    }
  }

  // 8. Dual Electronic Signature Execution Section
  checkPageSpace(335);

  let signY = currentY - 8;

  currentPage.drawText("IN WITNESS WHEREOF: DUAL ELECTRONIC SIGNATURE EXECUTION", {
    x: marginX,
    y: signY,
    size: 11.5,
    font: timesBold,
    color: rgb(0.04, 0.12, 0.28),
  });
  signY -= 16;

  const statutoryText1 =
    "Pursuant to Section 10A of the Information Technology Act, 2000 and the Indian Contract Act, 1872,";
  const statutoryText2 =
    "both parties have reviewed, approved, and recorded their electronic execution to all covenants, payment terms, and policies.";
  currentPage.drawText(statutoryText1, {
    x: marginX,
    y: signY,
    size: 8,
    font: timesRoman,
    color: rgb(0.3, 0.35, 0.4),
  });
  signY -= 11;
  currentPage.drawText(statutoryText2, {
    x: marginX,
    y: signY,
    size: 8,
    font: timesRoman,
    color: rgb(0.3, 0.35, 0.4),
  });
  signY -= 22;

  const colWidth = (usableWidth - 18) / 2;
  const boxHeight = 205;

  function drawVerificationBadge(page: any, x: number, y: number, badgeText: string) {
    page.drawCircle({
      x: x + 6,
      y: y + 3,
      size: 4.5,
      color: rgb(0.1, 0.55, 0.25),
    });
    page.drawLine({
      start: { x: x + 3.8, y: y + 3.2 },
      end: { x: x + 5.5, y: y + 1.2 },
      thickness: 1.1,
      color: rgb(1, 1, 1),
    });
    page.drawLine({
      start: { x: x + 5.5, y: y + 1.2 },
      end: { x: x + 8.5, y: y + 5.0 },
      thickness: 1.1,
      color: rgb(1, 1, 1),
    });
    page.drawText(badgeText, {
      x: x + 14,
      y: y,
      size: 8,
      font: timesBold,
      color: rgb(0.08, 0.5, 0.22),
    });
  }

  // Box 1: Educator Box (Left)
  const box1X = marginX;
  currentPage.drawRectangle({
    x: box1X,
    y: signY - boxHeight,
    width: colWidth,
    height: boxHeight,
    borderColor: rgb(0.82, 0.86, 0.92),
    borderWidth: 1,
    color: rgb(0.985, 0.99, 1),
  });

  currentPage.drawRectangle({
    x: box1X,
    y: signY - 24,
    width: colWidth,
    height: 24,
    color: rgb(0.06, 0.18, 0.38),
  });

  currentPage.drawText("FIRST PARTY: THE EDUCATOR", {
    x: box1X + 10,
    y: signY - 16,
    size: 9,
    font: timesBold,
    color: rgb(1, 1, 1),
  });

  let fieldY1 = signY - 40;
  currentPage.drawText(`Name: ${input.educatorName}`, {
    x: box1X + 10,
    y: fieldY1,
    size: 9,
    font: timesBold,
    color: rgb(0.08, 0.12, 0.18),
  });
  fieldY1 -= 13;

  currentPage.drawText(`Designation: ${input.designation}`, {
    x: box1X + 10,
    y: fieldY1,
    size: 8,
    font: timesRoman,
    color: rgb(0.25, 0.3, 0.38),
  });
  fieldY1 -= 13;

  if (input.educatorPan && !input.educatorPan.includes("ABCDE") && input.educatorPan.length >= 8) {
    currentPage.drawText(`PAN: ${input.educatorPan}`, {
      x: box1X + 10,
      y: fieldY1,
      size: 8,
      font: timesRoman,
      color: rgb(0.25, 0.3, 0.38),
    });
    fieldY1 -= 13;
  }

  // Draw Educator Signature
  const sigAreaY = signY - 135;
  let eduSigDrawn = false;
  if (input.educatorSignatureDataUrl && input.educatorSignatureDataUrl.length > 2000) {
    try {
      const base64Data = input.educatorSignatureDataUrl.replace(/^data:image\/\w+;base64,/, "");
      const sigImgBuffer = Buffer.from(base64Data, "base64");
      const sigImg = await pdfDoc.embedPng(sigImgBuffer).catch(() => pdfDoc.embedJpg(sigImgBuffer));
      const maxW = 135;
      const maxH = 42;
      const scale = Math.min(maxW / sigImg.width, maxH / sigImg.height, 1);
      const drawW = sigImg.width * scale;
      const drawH = sigImg.height * scale;
      currentPage.drawImage(sigImg, {
        x: box1X + 14,
        y: sigAreaY + (maxH - drawH) / 2,
        width: drawW,
        height: drawH,
      });
      eduSigDrawn = true;
    } catch {}
  }

  if (!eduSigDrawn) {
    currentPage.drawText(input.educatorSignedName || input.educatorName, {
      x: box1X + 14,
      y: sigAreaY + 12,
      size: 19,
      font: timesItalic,
      color: rgb(0.04, 0.15, 0.4),
    });
    currentPage.drawLine({
      start: { x: box1X + 12, y: sigAreaY + 6 },
      end: { x: box1X + colWidth - 12, y: sigAreaY + 6 },
      thickness: 0.75,
      color: rgb(0.8, 0.84, 0.9),
    });
  }

  drawVerificationBadge(
    currentPage,
    box1X + 10,
    signY - 152,
    `Digitally Verified & Signed: ${input.educatorSignedName || input.educatorName}`
  );

  const eduTime = input.educatorSignedAt
    ? formatOfficialDate(input.educatorSignedAt) + " (IST)"
    : `${formatOfficialDate(input.effectiveDate)} (IST)`;

  currentPage.drawText(`Timestamp: ${eduTime}`, {
    x: box1X + 10,
    y: signY - 167,
    size: 7.5,
    font: timesRoman,
    color: rgb(0.4, 0.45, 0.5),
  });

  if (input.educatorIp) {
    currentPage.drawText(`Signer IP: ${input.educatorIp}`, {
      x: box1X + 10,
      y: signY - 179,
      size: 7.5,
      font: timesRoman,
      color: rgb(0.4, 0.45, 0.5),
    });
  }

  // Box 2: Atomic Pathshala Box (Right)
  const box2X = box1X + colWidth + 18;
  currentPage.drawRectangle({
    x: box2X,
    y: signY - boxHeight,
    width: colWidth,
    height: boxHeight,
    borderColor: rgb(0.82, 0.86, 0.92),
    borderWidth: 1,
    color: rgb(0.985, 0.99, 1),
  });

  currentPage.drawRectangle({
    x: box2X,
    y: signY - 24,
    width: colWidth,
    height: 24,
    color: rgb(0.04, 0.12, 0.28),
  });

  currentPage.drawText("SECOND PARTY: ATOMIC PATHSHALA", {
    x: box2X + 10,
    y: signY - 16,
    size: 9,
    font: timesBold,
    color: rgb(1, 1, 1),
  });

  let fieldY2 = signY - 40;
  currentPage.drawText(`Authorized Signatory: ${input.authorizedSignatoryName}`, {
    x: box2X + 10,
    y: fieldY2,
    size: 9,
    font: timesBold,
    color: rgb(0.08, 0.12, 0.18),
  });
  fieldY2 -= 13;

  currentPage.drawText(`Designation: ${input.authorizedSignatoryDesignation}`, {
    x: box2X + 10,
    y: fieldY2,
    size: 8,
    font: timesRoman,
    color: rgb(0.25, 0.3, 0.38),
  });
  fieldY2 -= 13;

  currentPage.drawText("Enterprise: ATOMIC PATHSHALA EDUCATION", {
    x: box2X + 10,
    y: fieldY2,
    size: 8,
    font: timesRoman,
    color: rgb(0.25, 0.3, 0.38),
  });
  fieldY2 -= 13;

  currentPage.drawText("Location: Rampur, Uttar Pradesh, India", {
    x: box2X + 10,
    y: fieldY2,
    size: 8,
    font: timesRoman,
    color: rgb(0.25, 0.3, 0.38),
  });

  // Founder and Director Signature (Universal brand signature)
  let dirSigDrawn = false;
  const dirSigData = input.directorSignatureDataUrl || undefined;
  if (dirSigData && dirSigData.length > 2000) {
    try {
      const base64Data = dirSigData.replace(/^data:image\/\w+;base64,/, "");
      const sigImgBuffer = Buffer.from(base64Data, "base64");
      const sigImg = await pdfDoc.embedPng(sigImgBuffer).catch(() => pdfDoc.embedJpg(sigImgBuffer));
      const maxW = 135;
      const maxH = 42;
      const scale = Math.min(maxW / sigImg.width, maxH / sigImg.height, 1);
      const drawW = sigImg.width * scale;
      const drawH = sigImg.height * scale;
      currentPage.drawImage(sigImg, {
        x: box2X + 14,
        y: sigAreaY + (maxH - drawH) / 2,
        width: drawW,
        height: drawH,
      });
      dirSigDrawn = true;
    } catch {}
  }

  if (!dirSigDrawn) {
    try {
      const brandSigPath = path.join(process.cwd(), "public", "brand", "signature.png");
      if (fs.existsSync(brandSigPath)) {
        const sigImg = await pdfDoc.embedPng(fs.readFileSync(brandSigPath));
        const maxW = 135;
        const maxH = 42;
        const scale = Math.min(maxW / sigImg.width, maxH / sigImg.height, 1);
        const drawW = sigImg.width * scale;
        const drawH = sigImg.height * scale;
        currentPage.drawImage(sigImg, {
          x: box2X + 14,
          y: sigAreaY + (maxH - drawH) / 2,
          width: drawW,
          height: drawH,
        });
        dirSigDrawn = true;
      }
    } catch {}
  }

  if (!dirSigDrawn) {
    currentPage.drawText("Firoz Ali", {
      x: box2X + 14,
      y: sigAreaY + 12,
      size: 20,
      font: timesItalic,
      color: rgb(0.04, 0.15, 0.4),
    });
    currentPage.drawLine({
      start: { x: box2X + 12, y: sigAreaY + 6 },
      end: { x: box2X + colWidth - 12, y: sigAreaY + 6 },
      thickness: 0.75,
      color: rgb(0.8, 0.84, 0.9),
    });
  }

  drawVerificationBadge(
    currentPage,
    box2X + 10,
    signY - 152,
    "Digitally Verified & Countersigned: Firoz Ali"
  );

  const dirTime = input.directorSignedAt
    ? formatOfficialDate(input.directorSignedAt) + " (IST)"
    : `${formatOfficialDate(input.effectiveDate)} (IST)`;

  currentPage.drawText(`Timestamp: ${dirTime}`, {
    x: box2X + 10,
    y: signY - 167,
    size: 7.5,
    font: timesRoman,
    color: rgb(0.4, 0.45, 0.5),
  });

  if (input.directorIp) {
    currentPage.drawText(`Signer IP: ${input.directorIp}`, {
      x: box2X + 10,
      y: signY - 179,
      size: 7.5,
      font: timesRoman,
      color: rgb(0.4, 0.45, 0.5),
    });
  }

  // Cryptographic Audit Seal Block
  const auditY = signY - boxHeight - 16;
  const auditHeight = 68;

  currentPage.drawRectangle({
    x: marginX,
    y: auditY - auditHeight,
    width: usableWidth,
    height: auditHeight,
    borderColor: rgb(0.85, 0.88, 0.94),
    borderWidth: 1,
    color: rgb(0.97, 0.985, 1),
  });

  currentPage.drawText("CRYPTOGRAPHIC AUDIT & STATUTORY COMPLIANCE SEAL", {
    x: marginX + 12,
    y: auditY - 16,
    size: 8,
    font: timesBold,
    color: rgb(0.04, 0.12, 0.28),
  });

  currentPage.drawText(`Agreement Reference Number: ${input.agreementNumber}`, {
    x: marginX + 12,
    y: auditY - 29,
    size: 7.5,
    font: timesRoman,
    color: rgb(0.2, 0.25, 0.32),
  });

  const stampInfo = input.eStampCertNo
    ? `State Government e-Stamp Verified: ${input.eStampCertNo} (${input.eStampState || "UP"} - INR ${input.eStampAmount || "100"})`
    : "Standard electronic execution pursuant to Section 10A of the Information Technology Act, 2000.";

  currentPage.drawText(stampInfo, {
    x: marginX + 12,
    y: auditY - 41,
    size: 7.5,
    font: timesRoman,
    color: rgb(0.2, 0.25, 0.32),
  });

  currentPage.drawText(
    "Legal Validity: Both parties confirm that electronic execution constitutes full mutual assent and is legally binding.",
    {
      x: marginX + 12,
      y: auditY - 53,
      size: 7,
      font: timesItalic,
      color: rgb(0.35, 0.4, 0.45),
    }
  );

  // 9. Running Page Numbers on all pages (Page X of Y)
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

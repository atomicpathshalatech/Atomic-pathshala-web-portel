/**
 * ATOMIC PATHSHALA — COMPLETE CONTRACT & SERVICE AGREEMENT PDF ENGINE
 * Category 4: Complete Multi-Page Educator/Employee Service Agreement
 * 
 * Strict Universal Branding & Legal Architecture:
 * - Royal Blue + Navy Blue + White palette
 * - Times New Roman typography throughout
 * - Transparent central logo watermark on every page
 * - Thin royal blue border on every page
 * - Continuous page numbering ("Page X of Y")
 * - 24 legally compliant clauses + Annexures A, B, C + Execution Signatures & Witness blocks
 */

import { PDFDocument, PDFPage, PDFFont } from "pdf-lib";
import {
  UniversalFonts,
  embedUniversalFonts,
  loadBrandLogo,
  drawDocumentBorder,
  drawBrandWatermark,
  drawDocumentHeader,
  drawDocumentFooter,
  cleanWinAnsi,
  BRAND_COLORS,
} from "./universal-design-system";

export interface ContractLetterVariables {
  agreementReference: string; // AP-CON-YYYY-XXXX
  executionDateStr: string;
  effectiveDateStr: string;
  contractEndDateStr: string;

  // Party Details
  employeeName: string;
  employeeId: string;
  address?: string;
  panNumber?: string;
  email?: string;
  phone?: string;
  designation: string;
  department: string;
  subject?: string;
  engagementType: string; // "FULL_TIME", "PART_TIME", "CONSULTANT", "GUEST_FACULTY"

  // Assignment & Academic Responsibilities
  assignedBatch?: string;
  teachingMedium?: string;
  workLocation?: string;
  reportingAuthority?: string;
  workingSchedule?: string;
  academicSession?: string;

  // Compensation & Deliverables (Annexure A)
  compensationType?: string;
  monthlySalary?: string;
  annualSalary?: string;
  perLectureRate?: string;
  perHourRate?: string;
  teachingHoursMonthly?: string;
  paymentCycleDay?: string;
  noticePeriodDays?: string;

  // Annexure C
  specialConditions?: string;

  // Verification & Signatures
  qrCodeDataUrl?: string;
  verificationUrl?: string;
  directorSignedAt?: string;
  educatorSignedAt?: string;
}

export async function buildContractLetterPdf(
  vars: ContractLetterVariables
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const fonts = await embedUniversalFonts(pdfDoc);
  const logoImg = await loadBrandLogo(pdfDoc);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 46;
  const usableWidth = pageWidth - marginX * 2;
  const bottomMargin = 55;

  // We maintain a list of pages so we can draw borders, watermarks, running headers, and page numbers at the end
  const pages: PDFPage[] = [];

  function addNewPage(): { page: PDFPage; startY: number } {
    const p = pdfDoc.addPage([pageWidth, pageHeight]);
    pages.push(p);
    const isFirst = pages.length === 1;
    const startY = isFirst ? pageHeight - 110 : pageHeight - 65;
    return { page: p, startY };
  }

  let { page: currentPage, startY: currentY } = addNewPage();

  // Helper to ensure vertical space or roll over to new page
  function ensureSpace(requiredPt: number) {
    if (currentY - requiredPt < bottomMargin) {
      const res = addNewPage();
      currentPage = res.page;
      currentY = res.startY;
    }
  }

  function printLine(
    text: string,
    font: PDFFont,
    size: number,
    color = BRAND_COLORS.bodyText,
    extraY = 0
  ) {
    ensureSpace(size + 4 + extraY);
    currentPage.drawText(cleanWinAnsi(text), {
      x: marginX,
      y: currentY,
      size,
      font,
      color,
    });
    currentY -= size + 4 + extraY;
  }

  function printWrapped(
    text: string,
    font: PDFFont,
    size: number,
    lineHeight: number,
    indent = 0,
    color = BRAND_COLORS.bodyText
  ) {
    const words = cleanWinAnsi(text).split(" ");
    let line = "";
    const maxWidth = usableWidth - indent;

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, size);
      if (testWidth > maxWidth) {
        ensureSpace(lineHeight);
        currentPage.drawText(line, {
          x: marginX + indent,
          y: currentY,
          size,
          font,
          color,
        });
        line = word;
        currentY -= lineHeight;
      } else {
        line = testLine;
      }
    }

    if (line) {
      ensureSpace(lineHeight);
      currentPage.drawText(line, {
        x: marginX + indent,
        y: currentY,
        size,
        font,
        color,
      });
      currentY -= lineHeight;
    }
  }

  // 1. PAGE 1: TITLE BANNER
  const isConsultant = vars.engagementType === "CONSULTANT" || vars.engagementType === "GUEST_FACULTY";
  const docTitle = isConsultant ? "ACADEMIC CONSULTANT & SERVICE AGREEMENT" : "EDUCATOR SERVICE AGREEMENT";

  const titleWidth = fonts.timesBold.widthOfTextAtSize(docTitle, 13.5);
  currentPage.drawText(docTitle, {
    x: (pageWidth - titleWidth) / 2,
    y: currentY,
    size: 13.5,
    font: fonts.timesBold,
    color: BRAND_COLORS.navyBlue,
  });

  currentPage.drawLine({
    start: { x: (pageWidth - titleWidth) / 2 - 10, y: currentY - 5 },
    end: { x: (pageWidth + titleWidth) / 2 + 10, y: currentY - 5 },
    thickness: 1,
    color: BRAND_COLORS.accentBlue,
  });

  currentY -= 24;

  // 2. METADATA HEADER
  const metaText = `Agreement Reference: ${vars.agreementReference} | Execution: ${vars.executionDateStr} | Effective: ${vars.effectiveDateStr} | Expiry: ${vars.contractEndDateStr}`;
  currentPage.drawText(cleanWinAnsi(metaText), {
    x: marginX,
    y: currentY,
    size: 7.5,
    font: fonts.timesItalic,
    color: BRAND_COLORS.mutedText,
  });
  currentY -= 14;

  // 3. PREAMBLE & PARTIES
  const preamble = `THIS EDUCATOR SERVICE AGREEMENT (the "Agreement") is executed on this ${vars.executionDateStr} at Rampur, Uttar Pradesh, India, by and between:`;
  printWrapped(preamble, fonts.timesRoman, 8.5, 12);
  currentY -= 6;

  printWrapped(
    `1. FIRST PARTY (PLATFORM OWNER): FIROZ ALI, an individual carrying on educational coaching and academic tutoring under the registered enterprise name ATOMIC PATHSHALA EDUCATION and brand name Atomic Pathshala, having its principal business location at Rampur, Uttar Pradesh, India (hereinafter referred to as the "Platform Owner" or "Atomic Pathshala", which expression shall include his successors, representatives, and permitted assigns) of the FIRST PART;`,
    fonts.timesRoman,
    8.5,
    12,
    8
  );
  currentY -= 6;

  const educatorAddress = vars.address || "Rampur, Uttar Pradesh, India";
  printWrapped(
    `2. SECOND PARTY (${isConsultant ? "ACADEMIC CONSULTANT" : "EDUCATOR"}): ${vars.employeeName.toUpperCase()}, residing at ${educatorAddress}, bearing PAN ${vars.panNumber || "NOT_PROVIDED"} and Employee ID ${vars.employeeId} (hereinafter referred to as the "${isConsultant ? "Consultant" : "Educator"}", which expression shall include their legal heirs and administrators) of the SECOND PART.`,
    fonts.timesRoman,
    8.5,
    12,
    8
  );
  currentY -= 8;

  printWrapped(
    `WHEREAS the Platform Owner operates an advanced digital learning ecosystem under the brand name "Atomic Pathshala" for NEET, JEE, and Board examinations; and WHEREAS the ${isConsultant ? "Consultant" : "Educator"} possesses domain expertise in ${vars.subject || vars.department}; NOW, THEREFORE, the Parties agree as follows:`,
    fonts.timesRoman,
    8.5,
    12
  );
  currentY -= 12;

  // 4. CLAUSES 1 to 24 (Preserving all verified legal covenants)
  const clauses: { num: number; title: string; content: string[] }[] = [
    {
      num: 1,
      title: "DEFINITIONS AND INTERPRETATION",
      content: [
        `1.1 "Academic Materials" means all course handouts, lecture summaries, DPPs, tests, and answer keys prepared for courses.`,
        `1.2 "Agreement Term" means the duration from ${vars.effectiveDateStr} until ${vars.contractEndDateStr}, unless terminated earlier pursuant to Clause 19.`,
        `1.3 "Confidential Information" means all non-public technical, student, academic, or financial data, including student contact lists, compensation terms, internal question repositories, and software code.`,
        `1.4 "Educator Content" means lectures, digital whiteboard recordings, and test questions delivered or authored during the term.`,
        `1.5 "Student Data" means any personally identifiable records of students and parents protected under Indian privacy laws.`,
      ],
    },
    {
      num: 2,
      title: "APPOINTMENT AND NATURE OF ENGAGEMENT",
      content: [
        `2.1 Appointment: The Platform Owner engages the ${isConsultant ? "Consultant" : "Educator"} as ${vars.designation} in the Department of ${vars.department}, and the ${isConsultant ? "Consultant" : "Educator"} hereby accepts such engagement.`,
        `2.2 Engagement Model: The engagement model is stipulated as ${vars.engagementType.replace(/_/g, " ")}. The duties and deliverables are defined by Annexure A and Annexure B.`,
      ],
    },
    {
      num: 3,
      title: "SCOPE OF SERVICES AND ACADEMIC RESPONSIBILITIES",
      content: [
        `3.1 Delivering scheduled live interactive classes and recorded high-definition conceptual modules with academic precision.`,
        `3.2 Authoring and curating Daily Practice Problems (DPPs), mock test papers, and model answers aligned with latest NCERT/NEET/JEE syllabi.`,
        `3.3 Actively resolving student conceptual doubts on official platform channels and participating in faculty quality calibrations.`,
      ],
    },
    {
      num: 4,
      title: "TEACHING SCHEDULE AND DELIVERABLES",
      content: [
        `4.1 The ${isConsultant ? "Consultant" : "Educator"} shall deliver approximately ${vars.teachingHoursMonthly || "70 to 80"} scheduled teaching hours per calendar month as per the official Academic Timetable.`,
        `4.2 Strict syllabus completion pacing according to the institutional academic guide is an essential obligation of the engagement.`,
      ],
    },
    {
      num: 5,
      title: "ATTENDANCE, PUNCTUALITY AND RESCHEDULING",
      content: [
        `5.1 Live Class Readiness: The ${isConsultant ? "Consultant" : "Educator"} shall enter the studio or streaming interface at least 5 minutes prior to class start to verify AV transmission.`,
        `5.2 Notice for Planned Absence: Advance written notice of 24 to 48 hours is mandatory for leaves to allow orderly student rescheduling without disruption.`,
      ],
    },
    {
      num: 6,
      title: "COMPENSATION AND PAYMENT TERMS",
      content: [
        `6.1 Remuneration: The Platform Owner shall pay remuneration as set forth in Annexure A.`,
        `6.2 Payment Cycle: Monthly disbursements shall be credited on or before the ${vars.paymentCycleDay || "7th"} of each calendar month.`,
        `6.3 Statutory Deductions: All disbursements shall be subject to applicable Tax Deducted at Source (TDS) under the Income Tax Act, 1961.`,
      ],
    },
    {
      num: 7,
      title: "ACADEMIC QUALITY AND TEACHING BENCHMARKS",
      content: [
        `7.1 The ${isConsultant ? "Consultant" : "Educator"} shall maintain rigorous alignment with official NTA, NCERT, and CBSE examination guidelines.`,
        `7.2 Any conceptual or numerical slip occurring during a class shall be promptly rectified via an errata note within 24 hours.`,
      ],
    },
    {
      num: 8,
      title: "INTELLECTUAL PROPERTY AND COMMISSIONED CONTENT",
      content: [
        `8.1 Pre-Existing IP: Notes, publications, or teaching aids created prior to this engagement remain the personal IP of the ${isConsultant ? "Consultant" : "Educator"}.`,
        `8.2 Commissioned Works: All lecture recordings, video archives, test repositories, and whiteboard drawings created specifically for Atomic Pathshala constitute institutional educational assets.`,
        `8.3 Archival License: The institution holds an irrevocable, worldwide license to host, stream, and archive lectures for enrolled students throughout their academic cycle.`,
      ],
    },
    {
      num: 9,
      title: "CONFIDENTIALITY AND NON-DISCLOSURE (NDA)",
      content: [
        `9.1 Confidential Information must be held in strictest confidence and never disclosed to competing edtech entities.`,
        `9.2 Non-disclosure covenants survive the expiration or termination of this Agreement indefinitely as permitted by law.`,
      ],
    },
    {
      num: 10,
      title: "STUDENT DATA PROTECTION AND PRIVACY",
      content: [
        `10.1 Zero Scraping: Downloading, scraping, or storing student phone numbers or personal records is strictly prohibited.`,
        `10.2 Strict Compliance: The ${isConsultant ? "Consultant" : "Educator"} shall strictly adhere to the Digital Personal Data Protection Act, 2023.`,
      ],
    },
    {
      num: 11,
      title: "PLATFORM ACCESS AND DIGITAL SECURITY",
      content: [
        `11.1 Access credentials to the LMS, Live Studio, and Question Bank are non-transferable. Credential sharing constitutes a material breach.`,
      ],
    },
    {
      num: 12,
      title: "STUDENT COMMUNICATION AND FINANCIAL BOUNDARIES",
      content: [
        `12.1 Student communications must take place exclusively through official platform forums and monitored institutional channels.`,
        `12.2 The ${isConsultant ? "Consultant" : "Educator"} shall NEVER solicit or accept private tuition fees or direct payments from enrolled students or parents.`,
      ],
    },
    {
      num: 13,
      title: "PROFESSIONAL CONDUCT AND ETHICS",
      content: [
        `13.1 Modest attire, dignified academic language, and zero-tolerance against harassment or discrimination must be maintained at all times.`,
      ],
    },
    {
      num: 14,
      title: "BRAND REPRESENTATION AND SOCIAL MEDIA",
      content: [
        `14.1 Use of the Atomic Pathshala logo is restricted to authorized course promotion. Defamatory statements on public media are prohibited.`,
      ],
    },
    {
      num: 15,
      title: "EXCLUSIVITY (DURING ACTIVE ENGAGEMENT)",
      content: [
        vars.engagementType === "FULL_TIME"
          ? `15.1 During the active term, the Educator shall not teach parallel competitive coaching batches for directly competing online edtech portals without consent.`
          : `15.1 The Consultant may engage in other non-conflicting academic activities provided commitments to Atomic Pathshala batches are strictly honored.`,
        `15.2 In accordance with Section 27 of the Indian Contract Act, 1872, no post-termination restraint on lawful trade or profession is imposed.`,
      ],
    },
    {
      num: 16,
      title: "NON-SOLICITATION",
      content: [
        `16.1 During the term and for 12 months thereafter, the ${isConsultant ? "Consultant" : "Educator"} shall not directly solicit actively enrolled students away from the platform.`,
      ],
    },
    {
      num: 17,
      title: "REPRESENTATIONS AND WARRANTIES",
      content: [
        `17.1 The ${isConsultant ? "Consultant" : "Educator"} represents possessing valid academic qualifications and that all authored materials are original and non-infringing.`,
      ],
    },
    {
      num: 18,
      title: "TERM, DURATION AND RENEWAL",
      content: [
        `18.1 This Agreement is legally binding from ${vars.effectiveDateStr} until ${vars.contractEndDateStr}, unless terminated earlier under Clause 19.`,
      ],
    },
    {
      num: 19,
      title: "TERMINATION AND NOTICE PERIOD",
      content: [
        `19.1 Convenience: Either Party may terminate by serving ${vars.noticePeriodDays || "60"} days prior written notice.`,
        `19.2 Immediate Cause: The Platform Owner may terminate immediately for gross academic misconduct, credential theft, or harassment.`,
      ],
    },
    {
      num: 20,
      title: "HANDOVER AND STUDENT CONTINUITY",
      content: [
        `20.1 Upon notice of separation, the ${isConsultant ? "Consultant" : "Educator"} shall complete all ongoing lecture modules and handover all institutional records.`,
      ],
    },
    {
      num: 21,
      title: "LIMITATION OF LIABILITY AND INDEMNIFICATION",
      content: [
        `21.1 The ${isConsultant ? "Consultant" : "Educator"} indemnifies the Platform Owner against any third-party claims arising from willful misconduct or copyright infringement.`,
      ],
    },
    {
      num: 22,
      title: "FORCE MAJEURE",
      content: [
        `22.1 Neither Party shall be liable for delays caused by acts of God, pandemics, telecommunications grid failures, or governmental orders.`,
      ],
    },
    {
      num: 23,
      title: "DISPUTE RESOLUTION AND ARBITRATION",
      content: [
        `23.1 Disputes shall be resolved amicably, failing which they shall be referred to arbitration under the Arbitration and Conciliation Act, 1996. The seat and venue of arbitration shall be Rampur, Uttar Pradesh, India.`,
      ],
    },
    {
      num: 24,
      title: "GOVERNING LAW AND JURISDICTION",
      content: [
        `24.1 This Agreement shall be governed by the laws of India. Courts at Rampur, Uttar Pradesh shall have exclusive jurisdiction.`,
      ],
    },
  ];

  for (const c of clauses) {
    ensureSpace(34);
    printLine(`CLAUSE ${c.num} - ${c.title}`, fonts.timesBold, 8.5, BRAND_COLORS.navyBlue, 3);
    for (const item of c.content) {
      printWrapped(item, fonts.timesRoman, 8, 11.5, 6);
      currentY -= 3;
    }
    currentY -= 4;
  }

  // 5. SIGNATURE PAGE (Clean, professional two-party signature block)
  ensureSpace(140);
  printLine("IN WITNESS WHEREOF, the Parties have executed this Service Agreement as of the date first above written.", fonts.timesBoldItalic, 8.5, BRAND_COLORS.navyBlue, 12);

  const sigBoxHeight = 85;
  const colWidth = (usableWidth - 20) / 2;
  const box1X = marginX;
  const box2X = marginX + colWidth + 20;
  const sigBoxY = currentY - sigBoxHeight;

  // Box 1: Platform Owner
  currentPage.drawRectangle({
    x: box1X,
    y: sigBoxY,
    width: colWidth,
    height: sigBoxHeight,
    color: BRAND_COLORS.cardBg,
    borderColor: BRAND_COLORS.borderLight,
    borderWidth: 0.6,
  });

  currentPage.drawText("FIRST PARTY (PLATFORM OWNER)", {
    x: box1X + 10,
    y: sigBoxY + sigBoxHeight - 16,
    size: 7.5,
    font: fonts.timesBold,
    color: BRAND_COLORS.navyBlue,
  });

  currentPage.drawText("Firoz Ali", {
    x: box1X + 10,
    y: sigBoxY + sigBoxHeight - 38,
    size: 16,
    font: fonts.timesItalic,
    color: BRAND_COLORS.navyBlue,
  });

  currentPage.drawText("FIROZ ALI - Founder & Director", {
    x: box1X + 10,
    y: sigBoxY + sigBoxHeight - 52,
    size: 8,
    font: fonts.timesBold,
    color: BRAND_COLORS.navyBlue,
  });

  currentPage.drawText("ATOMIC PATHSHALA EDUCATION", {
    x: box1X + 10,
    y: sigBoxY + sigBoxHeight - 64,
    size: 7.5,
    font: fonts.timesRoman,
    color: BRAND_COLORS.mutedText,
  });

  currentPage.drawText("Rampur, Uttar Pradesh, India", {
    x: box1X + 10,
    y: sigBoxY + sigBoxHeight - 76,
    size: 7,
    font: fonts.timesRoman,
    color: BRAND_COLORS.mutedText,
  });

  // Box 2: Educator / Second Party
  currentPage.drawRectangle({
    x: box2X,
    y: sigBoxY,
    width: colWidth,
    height: sigBoxHeight,
    color: BRAND_COLORS.cardBg,
    borderColor: BRAND_COLORS.borderLight,
    borderWidth: 0.6,
  });

  currentPage.drawText(`SECOND PARTY (${isConsultant ? "CONSULTANT" : "EDUCATOR"})`, {
    x: box2X + 10,
    y: sigBoxY + sigBoxHeight - 16,
    size: 7.5,
    font: fonts.timesBold,
    color: BRAND_COLORS.navyBlue,
  });

  currentPage.drawText(cleanWinAnsi(vars.employeeName.toUpperCase()), {
    x: box2X + 10,
    y: sigBoxY + sigBoxHeight - 44,
    size: 9,
    font: fonts.timesBold,
    color: BRAND_COLORS.navyBlue,
  });

  currentPage.drawText(cleanWinAnsi(`Designation: ${vars.designation}`), {
    x: box2X + 10,
    y: sigBoxY + sigBoxHeight - 58,
    size: 7.5,
    font: fonts.timesRoman,
    color: BRAND_COLORS.bodyText,
  });

  currentPage.drawText(cleanWinAnsi(`Employee ID: ${vars.employeeId}`), {
    x: box2X + 10,
    y: sigBoxY + sigBoxHeight - 70,
    size: 7.5,
    font: fonts.timesRoman,
    color: BRAND_COLORS.mutedText,
  });

  currentY = sigBoxY - 20;

  // 6. ANNEXURES (Annexure A, B, C)
  ensureSpace(120);
  printLine("ANNEXURE A - REMUNERATION & COMMERCIAL TERMS", fonts.timesBold, 9, BRAND_COLORS.navyBlue, 6);

  const remuneration = vars.monthlySalary
    ? `Monthly Remuneration: INR ${vars.monthlySalary} /- per month`
    : vars.annualSalary
    ? `Annual Package: INR ${vars.annualSalary} /- per annum`
    : vars.perLectureRate
    ? `Per Lecture Rate: INR ${vars.perLectureRate} /- per delivered lecture`
    : "Remuneration: As mutually agreed and scheduled in writing.";

  printWrapped(`A.1 ${remuneration}`, fonts.timesRoman, 8, 12, 8);
  printWrapped(`A.2 Disbursement Schedule: Processed on or before the ${vars.paymentCycleDay || "7th"} of each calendar month.`, fonts.timesRoman, 8, 12, 8);
  printWrapped(`A.3 Statutory Compliance: Subject to applicable Indian Tax Deducted at Source (TDS).`, fonts.timesRoman, 8, 12, 8);
  currentY -= 8;

  ensureSpace(90);
  printLine("ANNEXURE B - ACADEMIC ASSIGNMENTS & TEACHING DUTIES", fonts.timesBold, 9, BRAND_COLORS.navyBlue, 6);
  printWrapped(`B.1 Academic Department: ${vars.department}`, fonts.timesRoman, 8, 12, 8);
  printWrapped(`B.2 Subject Area: ${vars.subject || vars.department}`, fonts.timesRoman, 8, 12, 8);
  printWrapped(`B.3 Assigned Batches: ${vars.assignedBatch || "Comprehensive NEET / JEE Academic Batches"}`, fonts.timesRoman, 8, 12, 8);
  printWrapped(`B.4 Work Location: ${vars.workLocation || "Rampur, Uttar Pradesh, India / Digital Streaming Studio"}`, fonts.timesRoman, 8, 12, 8);
  currentY -= 8;

  ensureSpace(70);
  printLine("ANNEXURE C - SPECIAL INSTITUTIONAL CONDITIONS", fonts.timesBold, 9, BRAND_COLORS.navyBlue, 6);
  printWrapped(`C.1 ${vars.specialConditions || "Standard institutional academic benchmarks apply. No special waivers granted."}`, fonts.timesRoman, 8, 12, 8);

  // 7. FINALIZE ALL PAGES (Apply thin royal blue border, subtle watermark, running header, and footer)
  const totalPages = pages.length;

  for (let idx = 0; idx < totalPages; idx++) {
    const p = pages[idx];
    const isFirst = idx === 0;

    // Thin royal blue border on every page
    drawDocumentBorder(p);

    // Subtle central logo watermark on every page
    drawBrandWatermark(p, logoImg);

    // Header (Page 1 gets full letterhead; subsequent pages get sleek running header)
    drawDocumentHeader(p, fonts, logoImg, {
      documentRef: vars.agreementReference,
      dateStr: vars.executionDateStr,
      isSubsequentPage: !isFirst,
      subsequentTitle: "ATOMIC PATHSHALA - SERVICE AGREEMENT",
    });

    // Running Footer with page numbering on every page
    drawDocumentFooter(p, fonts, idx + 1, totalPages, "Official Service Agreement");
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

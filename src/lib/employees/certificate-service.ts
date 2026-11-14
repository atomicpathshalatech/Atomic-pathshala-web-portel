/**
 * ATOMIC PATHSHALA EDUCATION
 * Employment Certificate Generation & Verification Engine
 * 
 * Supports:
 * - Experience Certificate (AP-EXP-YYYY-XXXX)
 * - Employment Verification Certificate (AP-EVC-YYYY-XXXX)
 * - Relieving Letter (AP-REL-YYYY-XXXX)
 * - Joining Letter Certificate (AP-JLC-YYYY-XXXX)
 */

import "server-only";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { prisma } from "@/lib/db";
import { EmployeeCertificateType } from "@prisma/client";
import { getAppBaseDomain, generateQrCodeDataUrl } from "./employee-service";
import { uploadFile } from "@/lib/storage";

function cleanWinAnsi(text: string): string {
  return text
    .replace(/[VERIFIED]/g, "[VERIFIED]")
    .replace(/✔/g, "[VERIFIED]")
    .replace(/—/g, "-")
    .replace(/–/g, "-")
    .replace(/•/g, "*")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x00-\xFF]/g, "");
}

export function getCertificatePrefix(type: EmployeeCertificateType): string {
  switch (type) {
    case "EXPERIENCE_CERTIFICATE":
      return "AP-EXP";
    case "EMPLOYMENT_VERIFICATION":
      return "AP-EVC";
    case "RELIEVING_LETTER":
      return "AP-REL";
    case "JOINING_LETTER":
      return "AP-JLC";
    default:
      return "AP-CERT";
  }
}

export async function generateCertificateNumber(type: EmployeeCertificateType): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `${getCertificatePrefix(type)}-${currentYear}-`;

  const count = await prisma.employeeCertificate.count({
    where: {
      certificateNumber: { startsWith: prefix },
    },
  });

  const nextSeq = count + 1;
  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

export type GenerateCertificateDto = {
  employeeId: string; // Database ID or AP-EMP-...
  certificateType: EmployeeCertificateType;
  issueDate?: string | Date;
  conductRemarks?: string;
  customDesignation?: string;
  customDepartment?: string;
  customTenureStart?: string;
  customTenureEnd?: string;
  notes?: string;
  createdById?: string;
};

/**
 * Compile the formal corporate text for the certificate
 */
export function compileCertificateText(params: {
  certificateNumber: string;
  certificateType: EmployeeCertificateType;
  issueDateStr: string;
  employeeName: string;
  employeeId: string;
  designation: string;
  department: string;
  startDateStr: string;
  endDateStr: string;
  conductRemarks?: string;
}): { title: string; body: string } {
  const {
    certificateNumber,
    certificateType,
    issueDateStr,
    employeeName,
    employeeId,
    designation,
    department,
    startDateStr,
    endDateStr,
    conductRemarks,
  } = params;

  let title = "EXPERIENCE CERTIFICATE";
  let body = "";

  switch (certificateType) {
    case "EXPERIENCE_CERTIFICATE":
      title = "EXPERIENCE CERTIFICATE";
      body = `TO WHOMSOEVER IT MAY CONCERN

This is to officially certify that ${employeeName} (Employee ID: ${employeeId}) was engaged with ATOMIC PATHSHALA EDUCATION, operating under the brand name Atomic Pathshala, having its business location at Rampur, Uttar Pradesh, India.

During their tenure from ${startDateStr} to ${endDateStr}, ${employeeName} served with commitment and pedagogical excellence as ${designation} in the Department of ${department}.

During their service with us, they demonstrated exceptional domain competence, strong pedagogical leadership, academic rigor, and adherence to institutional quality benchmarks. ${conductRemarks || "Their professional conduct, character, and integrity were found to be exemplary throughout their engagement."}

We thank ${employeeName} for their valuable academic contributions to the institution and wish them the very best in all their future professional endeavors.

Issued on this ${issueDateStr} at Rampur, Uttar Pradesh, India.`;
      break;

    case "EMPLOYMENT_VERIFICATION":
      title = "EMPLOYMENT VERIFICATION CERTIFICATE";
      body = `TO WHOMSOEVER IT MAY CONCERN

This is to officially verify that ${employeeName} (Employee ID: ${employeeId}) is currently a bonafide employee of ATOMIC PATHSHALA EDUCATION, operating under the brand name Atomic Pathshala, having its business location at Rampur, Uttar Pradesh, India.

Official Employment Details:
- Full Legal Name        : ${employeeName}
- Employee Reference ID  : ${employeeId}
- Current Designation    : ${designation}
- Academic Department    : ${department}
- Date of Joining        : ${startDateStr}
- Official Employment Status: Active / In Service
- Work Location          : Rampur, Uttar Pradesh, India / Digital Learning Studio

This certificate is issued at the request of the employee for official identification and background verification purposes.

Issued on this ${issueDateStr} at Rampur, Uttar Pradesh, India.`;
      break;

    case "RELIEVING_LETTER":
      title = "OFFICIAL RELIEVING LETTER";
      body = `Ref: ${certificateNumber}
Date: ${issueDateStr}

To,
${employeeName}
Employee ID: ${employeeId}
Department of ${department}

Subject: Relieving Letter & Formal Clearance of Service

Dear ${employeeName},

With reference to your formal resignation, we hereby confirm that you have been officially relieved from your duties as ${designation} in the Department of ${department} at ATOMIC PATHSHALA EDUCATION (Brand: Atomic Pathshala), with effect from the close of working hours on ${endDateStr}.

We confirm that you have completed all academic syllabus handovers, returned institutional digital credentials, and fulfilled your contractual obligations in a professional and satisfactory manner.

We appreciate the dedication and academic service you rendered during your association with Atomic Pathshala and wish you continued success in your career.

Yours Sincerely,`;
      break;

    case "JOINING_LETTER":
      title = "APPOINTMENT & JOINING CERTIFICATE";
      body = `OFFICIAL CERTIFICATE OF JOINING & ENGAGEMENT

This is to certify that ${employeeName} (Employee ID: ${employeeId}) has formally joined ATOMIC PATHSHALA EDUCATION, operating under the brand name Atomic Pathshala, as ${designation} in the Department of ${department}, effective from ${startDateStr}.

The employee's credentials, qualifications, and pedagogical records have been duly authenticated in the institutional employee repository.

Issued on this ${issueDateStr} at Rampur, Uttar Pradesh, India.`;
      break;
  }

  return { title, body };
}

/**
 * Generate PDF for the certificate with pdf-lib, embedding official logo, Times New Roman typography, QR code and official seal
 */
export async function buildCertificatePdf(params: {
  certificateNumber: string;
  title: string;
  bodyText: string;
  issueDateStr: string;
  employeeName: string;
  employeeId: string;
  qrCodeDataUrl: string;
  verificationUrl: string;
}): Promise<{ pdfBuffer: Buffer; documentHash: string }> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  // 1. Embed Times New Roman Font Suite
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
    console.warn("[certificate-service] Could not load logo image:", err);
  }

  const marginX = 52;
  const usableWidth = width - marginX * 2;

  // 3. Official Corporate Letterhead
  const headerTopY = height - 42;
  const logoSize = 52;

  if (embeddedLogo) {
    page.drawImage(embeddedLogo, {
      x: marginX,
      y: headerTopY - logoSize + 6,
      width: logoSize,
      height: logoSize,
    });
  }

  const textStartX = embeddedLogo ? marginX + logoSize + 14 : marginX;

  // Registered Enterprise Name
  page.drawText("ATOMIC PATHSHALA EDUCATION", {
    x: textStartX,
    y: headerTopY,
    size: 14,
    font: timesBold,
    color: rgb(0.04, 0.12, 0.28), // Deep Navy
  });

  // Corporate Subtitle
  page.drawText("Official Certificate of Record - Academic & Faculty Directorate", {
    x: textStartX,
    y: headerTopY - 14,
    size: 9,
    font: timesRoman,
    color: rgb(0.35, 0.4, 0.45),
  });

  // Official Location & Domain
  page.drawText("Head Office: Rampur, Uttar Pradesh, India - https://atomicpathshala.in", {
    x: textStartX,
    y: headerTopY - 26,
    size: 8.5,
    font: timesRoman,
    color: rgb(0.4, 0.45, 0.5),
  });

  // Top Right Reference & Issue Date
  const refText = `Cert Ref: ${params.certificateNumber}`;
  const dateText = `Date of Issue: ${params.issueDateStr}`;
  const refWidth = timesBold.widthOfTextAtSize(refText, 8.5);
  const dateWidth = timesRoman.widthOfTextAtSize(dateText, 8.5);

  page.drawText(refText, {
    x: width - marginX - refWidth,
    y: headerTopY - 2,
    size: 8.5,
    font: timesBold,
    color: rgb(0.04, 0.12, 0.28),
  });

  page.drawText(dateText, {
    x: width - marginX - dateWidth,
    y: headerTopY - 16,
    size: 8.5,
    font: timesRoman,
    color: rgb(0.35, 0.4, 0.45),
  });

  // Dual Letterhead Accent Rules (Navy & Gold)
  const ruleY = headerTopY - logoSize - 4;
  page.drawLine({
    start: { x: marginX, y: ruleY },
    end: { x: width - marginX, y: ruleY },
    thickness: 1.5,
    color: rgb(0.04, 0.12, 0.28), // Navy
  });
  page.drawLine({
    start: { x: marginX, y: ruleY - 3 },
    end: { x: width - marginX, y: ruleY - 3 },
    thickness: 0.75,
    color: rgb(0.83, 0.69, 0.22), // Gold
  });

  // 4. Certificate Document Title (Times Bold, Centered)
  let currentY = ruleY - 42;
  const cleanTitle = cleanWinAnsi(params.title);
  const titleWidth = timesBold.widthOfTextAtSize(cleanTitle, 15);
  page.drawText(cleanTitle, {
    x: (width - titleWidth) / 2,
    y: currentY,
    size: 15,
    font: timesBold,
    color: rgb(0.04, 0.12, 0.28),
  });

  // Decorative Accent Under Title
  currentY -= 8;
  page.drawLine({
    start: { x: (width - titleWidth) / 2 - 10, y: currentY },
    end: { x: (width + titleWidth) / 2 + 10, y: currentY },
    thickness: 1,
    color: rgb(0.83, 0.69, 0.22), // Gold
  });

  // 5. Body Text Paragraphs (Times Roman, Professional Leading)
  currentY -= 32;
  const rawLines = params.bodyText.split("\n");

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (trimmed.length === 0) {
      currentY -= 12;
      continue;
    }

    const cleaned = cleanWinAnsi(rawLine);
    const isHeaderLine =
      cleaned.startsWith("TO WHOMSOEVER") ||
      cleaned.startsWith("Subject:") ||
      cleaned.startsWith("Ref:") ||
      cleaned.startsWith("Official Employment Details:") ||
      cleaned.startsWith("Dear ");

    const words = cleaned.split(" ");
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const lineWidth = timesRoman.widthOfTextAtSize(testLine, 10.5);

      if (lineWidth > usableWidth) {
        page.drawText(currentLine, {
          x: marginX,
          y: currentY,
          size: 10.5,
          font: isHeaderLine ? timesBold : timesRoman,
          color: rgb(0.12, 0.15, 0.2),
        });
        currentLine = word;
        currentY -= 17;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      page.drawText(currentLine, {
        x: marginX,
        y: currentY,
        size: 10.5,
        font: isHeaderLine ? timesBold : timesRoman,
        color: rgb(0.12, 0.15, 0.2),
      });
      currentY -= 17;
    }
  }

  // 6. Footer Execution & Dual Verification Block
  const footerY = 160;
  const footerBoxHeight = 110;

  page.drawRectangle({
    x: marginX,
    y: footerY - footerBoxHeight,
    width: usableWidth,
    height: footerBoxHeight,
    color: rgb(0.98, 0.99, 1),
    borderColor: rgb(0.85, 0.88, 0.94),
    borderWidth: 1,
  });

  // Embed QR Code
  try {
    const qrBase64 = params.qrCodeDataUrl.replace(/^data:image\/\w+;base64,/, "");
    const qrBuffer = Buffer.from(qrBase64, "base64");
    const qrImg = await pdfDoc.embedPng(qrBuffer);
    page.drawImage(qrImg, {
      x: marginX + 12,
      y: footerY - footerBoxHeight + 12,
      width: 86,
      height: 86,
    });
  } catch (e) {
    console.warn("[certificate-service] QR embed notice:", e);
  }

  // QR Instructions & Verification details
  page.drawText("OFFICIAL PUBLIC VERIFICATION QR", {
    x: marginX + 110,
    y: footerY - 24,
    size: 8.5,
    font: timesBold,
    color: rgb(0.04, 0.12, 0.28),
  });

  page.drawText("Scan this QR code with any smartphone to verify the authenticity", {
    x: marginX + 110,
    y: footerY - 38,
    size: 8,
    font: timesRoman,
    color: rgb(0.3, 0.35, 0.4),
  });

  page.drawText("of this credential directly on the official institutional portal:", {
    x: marginX + 110,
    y: footerY - 50,
    size: 8,
    font: timesRoman,
    color: rgb(0.3, 0.35, 0.4),
  });

  const cleanVerifyUrl = cleanWinAnsi(params.verificationUrl);
  page.drawText(cleanVerifyUrl, {
    x: marginX + 110,
    y: footerY - 64,
    size: 7.5,
    font: timesBold,
    color: rgb(0.04, 0.22, 0.55),
  });

  page.drawText(`Certificate ID: ${params.certificateNumber} - Issued: ${params.issueDateStr}`, {
    x: marginX + 110,
    y: footerY - 78,
    size: 7.5,
    font: timesItalic,
    color: rgb(0.4, 0.45, 0.5),
  });

  page.drawText("[VERIFIED INSTITUTIONAL RECORD]", {
    x: marginX + 110,
    y: footerY - 92,
    size: 7.5,
    font: timesBold,
    color: rgb(0.08, 0.55, 0.25),
  });

  // Authorized Signatory Seal (Right side)
  const sigX = width - marginX - 170;

  page.drawText("AUTHORIZED SIGNATORY", {
    x: sigX,
    y: footerY - 24,
    size: 8,
    font: timesBold,
    color: rgb(0.04, 0.12, 0.28),
  });

  // Calligraphic script signature
  page.drawText("Firoz Ali", {
    x: sigX,
    y: footerY - 48,
    size: 19,
    font: timesItalic,
    color: rgb(0.04, 0.12, 0.28),
  });

  page.drawText("FIROZ ALI", {
    x: sigX,
    y: footerY - 62,
    size: 9.5,
    font: timesBold,
    color: rgb(0.04, 0.12, 0.28),
  });

  page.drawText("Founder and Director", {
    x: sigX,
    y: footerY - 74,
    size: 8,
    font: timesRoman,
    color: rgb(0.3, 0.35, 0.4),
  });

  page.drawText("ATOMIC PATHSHALA EDUCATION", {
    x: sigX,
    y: footerY - 86,
    size: 7.5,
    font: timesBold,
    color: rgb(0.3, 0.35, 0.4),
  });

  page.drawText("Rampur, Uttar Pradesh, India", {
    x: sigX,
    y: footerY - 98,
    size: 7.5,
    font: timesRoman,
    color: rgb(0.4, 0.45, 0.5),
  });

  // 7. Security Guarantee & Running Page Footer
  page.drawLine({
    start: { x: marginX, y: 38 },
    end: { x: width - marginX, y: 38 },
    thickness: 0.5,
    color: rgb(0.85, 0.88, 0.92),
  });

  page.drawText("Atomic Pathshala - Rampur, Uttar Pradesh, India - Official Service Certificate", {
    x: marginX,
    y: 26,
    size: 8,
    font: timesRoman,
    color: rgb(0.4, 0.45, 0.5),
  });

  page.drawText("Page 1 of 1", {
    x: width - marginX - timesBold.widthOfTextAtSize("Page 1 of 1", 8),
    y: 26,
    size: 8,
    font: timesBold,
    color: rgb(0.3, 0.35, 0.4),
  });

  const pdfBytes = await pdfDoc.save();
  const pdfBuffer = Buffer.from(pdfBytes);
  const documentHash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

  return { pdfBuffer, documentHash };
}

/**
 * Generate, record, and store an Employment Certificate
 */
export async function generateCertificate(dto: GenerateCertificateDto) {
  const employee = await prisma.employee.findFirst({
    where: {
      OR: [{ id: dto.employeeId }, { employeeId: dto.employeeId }],
    },
  });
  if (!employee) throw new Error("Employee record not found.");

  const certificateNumber = await generateCertificateNumber(dto.certificateType);
  const verificationToken = crypto.randomBytes(16).toString("base64url");
  const baseDomain = getAppBaseDomain();
  const verificationUrl = `${baseDomain}/verify/cert/${certificateNumber}`;
  const qrCodeDataUrl = await generateQrCodeDataUrl(verificationUrl);

  const issueDate = dto.issueDate ? new Date(dto.issueDate) : new Date();
  const issueDateStr = issueDate.toLocaleDateString("en-IN", { dateStyle: "long" });
  const startDateStr = dto.customTenureStart || employee.dateOfJoining.toLocaleDateString("en-IN", { dateStyle: "long" });
  const endDateStr = dto.customTenureEnd || (employee.lastWorkingDate ? employee.lastWorkingDate.toLocaleDateString("en-IN", { dateStyle: "long" }) : "Present");

  const { title, body } = compileCertificateText({
    certificateNumber,
    certificateType: dto.certificateType,
    issueDateStr,
    employeeName: employee.name,
    employeeId: employee.employeeId,
    designation: dto.customDesignation || employee.designation,
    department: dto.customDepartment || employee.department,
    startDateStr,
    endDateStr,
    conductRemarks: dto.conductRemarks,
  });

  // Build PDF
  const { pdfBuffer, documentHash } = await buildCertificatePdf({
    certificateNumber,
    title,
    bodyText: body,
    issueDateStr,
    employeeName: employee.name,
    employeeId: employee.employeeId,
    qrCodeDataUrl,
    verificationUrl,
  });

  // Upload to R2
  let pdfUrl: string | null = null;
  const s3Key = `Certificates/${employee.employeeId}/${certificateNumber}.pdf`;
  try {
    const uploaded = await uploadFile({
      key: s3Key,
      body: pdfBuffer,
      contentType: "application/pdf",
    });
    pdfUrl = uploaded;
  } catch (e) {
    console.warn("[certificate-service] R2 upload notice:", e);
  }

  // Save to DB
  const certificate = await prisma.employeeCertificate.create({
    data: {
      certificateNumber,
      certificateType: dto.certificateType,
      employeeId: employee.id,
      issueDate,
      issuedBy: "Firoz Ali",
      issuedByDesignation: "Founder and Director",
      contentSnapshot: body,
      pdfUrl: pdfUrl || s3Key,
      pdfHash: documentHash,
      verificationToken,
      qrCodeDataUrl,
      status: "ACTIVE",
      createdById: dto.createdById || null,
    },
  });

  return certificate;
}

/**
 * Public Certificate Verification
 */
export async function verifyCertificatePublic(
  identifier: string,
  meta?: { ip?: string; userAgent?: string }
) {
  const cleanId = decodeURIComponent(identifier).trim();

  const certificate = await prisma.employeeCertificate.findFirst({
    where: {
      OR: [
        { certificateNumber: { equals: cleanId, mode: "insensitive" } },
        { verificationToken: cleanId },
      ],
    },
    include: {
      employee: true,
    },
  });

  const enterpriseName = "ATOMIC PATHSHALA EDUCATION";
  const brandName = "Atomic Pathshala";
  const location = "Rampur, Uttar Pradesh, India";
  const website = "https://atomicpathshala.in";

  if (!certificate) {
    await prisma.employeeVerificationLog.create({
      data: {
        verificationType: "CERTIFICATE_QR_SCAN",
        lookupIdentifier: cleanId,
        resultStatus: "INVALID_CERTIFICATE",
        ipAddress: meta?.ip || null,
        userAgent: meta?.userAgent || null,
      },
    }).catch(() => {});

    return {
      isValid: false,
      officialStatus: "INVALID_CERTIFICATE",
      statusBadge: {
        label: "INVALID CERTIFICATE",
        tone: "danger",
        description: "This Certificate Reference or QR code does not match any genuine certificate issued by Atomic Pathshala Education.",
      },
      enterpriseName,
      brandName,
      location,
      website,
    };
  }

  const isRevoked = certificate.status === "REVOKED";

  await prisma.employeeVerificationLog.create({
    data: {
      certificateId: certificate.id,
      employeeId: certificate.employeeId,
      verificationType: "CERTIFICATE_QR_SCAN",
      lookupIdentifier: cleanId,
      resultStatus: isRevoked ? "REVOKED_CERTIFICATE" : "VERIFIED_GENUINE",
      ipAddress: meta?.ip || null,
      userAgent: meta?.userAgent || null,
    },
  }).catch(() => {});

  return {
    isValid: !isRevoked,
    officialStatus: isRevoked ? "REVOKED_CERTIFICATE" : "VERIFIED_GENUINE",
    statusBadge: {
      label: isRevoked ? "REVOKED CERTIFICATE" : "OFFICIALLY VERIFIED & GENUINE",
      tone: isRevoked ? "danger" : "success",
      description: isRevoked
        ? `This certificate was officially revoked. Reason: ${certificate.revocationReason || "Administrative invalidation"}.`
        : "Official Genuine Certificate issued by Atomic Pathshala Education and signed by Firoz Ali, Founder and Director.",
    },
    enterpriseName,
    brandName,
    location,
    website,
    certificate: {
      certificateNumber: certificate.certificateNumber,
      certificateType: certificate.certificateType.replace(/_/g, " "),
      employeeName: certificate.employee.name,
      employeeId: certificate.employee.employeeId,
      designation: certificate.employee.designation,
      department: certificate.employee.department,
      issueDate: certificate.issueDate.toLocaleDateString("en-IN", { dateStyle: "long" }),
      issuedBy: `${certificate.issuedBy}, ${certificate.issuedByDesignation}`,
      pdfUrl: certificate.pdfUrl,
      pdfHash: certificate.pdfHash,
      status: certificate.status,
      verifiedAt: new Date().toISOString(),
    },
  };
}

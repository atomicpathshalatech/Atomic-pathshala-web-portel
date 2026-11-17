import "server-only";
import crypto from "crypto";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { dispatchEmail } from "@/lib/email/dispatch";
import { getAppBaseUrl } from "@/lib/email/app-url";
import { uploadFile } from "@/lib/storage";
import { sendWhatsAppMessage, sanitizeIndianPhoneNumber } from "@/lib/whatsapp/provider";
import { loadCard, cardHtml } from "./data";
import { renderCardPdf } from "./pdf";
import { idCardEmail } from "./email";
import { buildJoiningConfirmationPdf } from "@/lib/documents/joining-confirmation-template";
import { buildExperienceCertificatePdf } from "@/lib/documents/experience-certificate-template";
import { buildRelievingLetterPdf } from "@/lib/documents/relieving-letter-template";
import { buildContractLetterPdf } from "@/lib/documents/contract-letter-template";
import { generateCertificateNumber } from "@/lib/employees/certificate-service";
import { formatOfficialDate } from "@/lib/documents/universal-design-system";

export type IndividualDocType =
  | "ID_CARD"
  | "JOINING_LETTER"
  | "EXPERIENCE_CERTIFICATE"
  | "RELIEVING_LETTER"
  | "CONTRACT_LETTER"
  | "CUSTOM_EMAIL";

export interface IndividualDocPayload {
  userId: string;
  kind: "TEAM" | "STUDENT";
  documentType: IndividualDocType;
  channel: "email" | "whatsapp";
  customSubject?: string;
  customMessage?: string;
  // Field overrides
  joiningDate?: string;
  designation?: string;
  department?: string;
  workLocation?: string;
  reportingAuthority?: string;
  assignedSubject?: string;
  assignedBatch?: string;
  tenureStart?: string;
  tenureEnd?: string;
  relievingDate?: string;
  conductRemarks?: string;
  monthlySalary?: string;
  annualSalary?: string;
  noticePeriodDays?: string;
  specialConditions?: string;
}

/**
 * Ensures a User has a linked Employee record with an official employeeId (AP10001+)
 */
export async function getOrCreateEmployeeForUser(userId: string) {
  let employee = await prisma.employee.findFirst({
    where: { userId },
    include: { certificates: true },
  });
  if (employee) return employee;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { teacher: true, role: true },
  });
  if (!user) return null;

  if (user.email) {
    employee = await prisma.employee.findFirst({
      where: { email: { equals: user.email.trim(), mode: "insensitive" } },
      include: { certificates: true },
    });
    if (employee) {
      await prisma.employee.update({
        where: { id: employee.id },
        data: { userId: user.id, teacherId: user.teacher?.id || employee.teacherId },
      });
      return employee;
    }
  }

  // Next employee sequence
  const allEmp = await prisma.employee.findMany({
    select: { employeeId: true },
  });
  let maxNum = 10000;
  for (const e of allEmp) {
    const num = parseInt(e.employeeId.replace(/\D/g, ""), 10);
    if (!isNaN(num) && num > maxNum) maxNum = num;
  }
  const nextSeq = maxNum + 1;
  const employeeId = user.teacher?.employeeCode || `AP${nextSeq}`;
  const verificationToken = crypto.randomUUID();
  const baseDomain = getAppBaseUrl();
  const verificationUrl = `${baseDomain}/verify/${employeeId}`;
  const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, { margin: 1, width: 250 });

  employee = await prisma.employee.create({
    data: {
      employeeId,
      name: user.name,
      email: user.email || null,
      phone: user.phone || null,
      photoUrl: user.photoUrl || null,
      designation:
        user.position ||
        (user.teacher?.subjects?.[0] ? `${user.teacher.subjects[0]} Faculty` : user.role?.label || "Faculty Member"),
      department: user.department || user.teacher?.department || "Academic",
      dateOfJoining: user.contractStart || user.createdAt,
      employmentType: "FULL_TIME",
      workLocation: "Rampur, Uttar Pradesh, India",
      status: "ACTIVE",
      verificationStatus: "VERIFIED",
      verificationToken,
      qrCodeDataUrl,
      userId: user.id,
      teacherId: user.teacher?.id || null,
      notes: "Synchronized from user registry",
    },
    include: { certificates: true },
  });

  return employee;
}

/**
 * Builds the PDF buffer for the requested document type
 */
export async function buildIndividualDocumentPdf(
  input: IndividualDocPayload
): Promise<{ pdfBuffer: Buffer; filename: string; title: string }> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    include: { teacher: true, student: true, role: true },
  });
  if (!user) throw new Error("User not found");

  const baseUrl = getAppBaseUrl();

  if (input.documentType === "ID_CARD") {
    const loaded = await loadCard(input.kind, user.id);
    if (!loaded) throw new Error("Card data not found");
    if (!loaded.model) {
      throw new Error(`ID card is incomplete: ${loaded.missing.map((m) => m.label).join(", ")}. Please complete photo/details first.`);
    }
    const html = cardHtml(loaded.model, "pdf");
    const pdfBuffer = await renderCardPdf(html);
    const safeName = user.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return {
      pdfBuffer,
      filename: `Atomic-Pathshala-ID-${safeName || "Card"}.pdf`,
      title: `${user.name} — ID Card`,
    };
  }

  // Official Institutional Letters (For Team Members)
  const employee = await getOrCreateEmployeeForUser(user.id);
  if (!employee) throw new Error("Employee record could not be resolved");

  const todayStr = formatOfficialDate(new Date());
  const empName = user.name || employee.name;
  const empId = employee.employeeId;
  const designation = input.designation || employee.designation || user.position || "Faculty Member";
  const department = input.department || employee.department || "Academic Department";
  const safeName = empName.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");

  if (input.documentType === "JOINING_LETTER") {
    const documentRef = await generateCertificateNumber("JOINING_LETTER");
    const joiningDateStr = formatOfficialDate(input.joiningDate || user.contractStart || employee.dateOfJoining);
    const verificationUrl = `${baseUrl}/verify/${empId}`;
    const qrCodeDataUrl = employee.qrCodeDataUrl || (await QRCode.toDataURL(verificationUrl, { margin: 1, width: 250 }));

    const pdfBuffer = await buildJoiningConfirmationPdf({
      documentRef,
      issueDateStr: todayStr,
      employeeName: empName,
      employeeId: empId,
      designation,
      department,
      employmentType: "Full-Time Engagement",
      joiningDateStr,
      reportingAuthority: input.reportingAuthority || "Founder & Director",
      assignedSubject: input.assignedSubject || user.teacher?.subjects?.[0] || undefined,
      assignedBatch: input.assignedBatch || employee.assignedBatch || "Comprehensive NEET / JEE Academic Batches",
      workLocation: input.workLocation || employee.workLocation || "Rampur, Uttar Pradesh, India / Digital Studio",
      workingSchedule: "Monday to Saturday, Scheduled Live Academic Sessions",
      compensationReference: "As per executed Service Agreement / Official Offer Terms",
      qrCodeDataUrl,
      verificationUrl,
    });

    return {
      pdfBuffer,
      filename: `Atomic-Pathshala-Joining-Letter-${safeName}-${empId}.pdf`,
      title: `Official Joining Confirmation — ${empName}`,
    };
  }

  if (input.documentType === "EXPERIENCE_CERTIFICATE") {
    const certificateNumber = await generateCertificateNumber("EXPERIENCE_CERTIFICATE");
    const startDateStr = formatOfficialDate(input.tenureStart || user.contractStart || employee.dateOfJoining);
    const endDateStr = formatOfficialDate(input.tenureEnd || new Date());
    const verificationUrl = `${baseUrl}/verify/${empId}`;
    const qrCodeDataUrl = employee.qrCodeDataUrl || (await QRCode.toDataURL(verificationUrl, { margin: 1, width: 250 }));

    const pdfBuffer = await buildExperienceCertificatePdf({
      certificateNumber,
      issueDateStr: todayStr,
      employeeName: empName,
      employeeId: empId,
      designation,
      department,
      startDateStr,
      endDateStr,
      conductRemarks:
        input.conductRemarks ||
        "Exemplary conduct, academic rigor, pedagogical leadership, and commendable dedication to student success.",
      qrCodeDataUrl,
      verificationUrl,
    });

    return {
      pdfBuffer,
      filename: `Atomic-Pathshala-Experience-Certificate-${safeName}-${empId}.pdf`,
      title: `Service & Experience Certificate — ${empName}`,
    };
  }

  if (input.documentType === "RELIEVING_LETTER") {
    const documentRef = await generateCertificateNumber("RELIEVING_LETTER");
    const joiningDateStr = formatOfficialDate(input.joiningDate || user.contractStart || employee.dateOfJoining);
    const relievingDateStr = formatOfficialDate(input.relievingDate || new Date());
    const verificationUrl = `${baseUrl}/verify/${empId}`;
    const qrCodeDataUrl = employee.qrCodeDataUrl || (await QRCode.toDataURL(verificationUrl, { margin: 1, width: 250 }));

    const pdfBuffer = await buildRelievingLetterPdf({
      documentRef,
      issueDateStr: todayStr,
      employeeName: empName,
      employeeId: empId,
      designation,
      department,
      joiningDateStr,
      relievingDateStr,
      resignationRefDateStr: todayStr,
      handoverStatus: "Completed & Verified",
      assetsStatus: "Returned & Deactivated",
      duesStatus: "Settled in Full",
      qrCodeDataUrl,
      verificationUrl,
    });

    return {
      pdfBuffer,
      filename: `Atomic-Pathshala-Relieving-Letter-${safeName}-${empId}.pdf`,
      title: `Official Relieving Letter — ${empName}`,
    };
  }

  if (input.documentType === "CONTRACT_LETTER") {
    const agreementReference = await generateCertificateNumber("CONTRACT_LETTER");
    const effectiveDateStr = formatOfficialDate(input.joiningDate || user.contractStart || employee.dateOfJoining);
    const contractEndDateStr = formatOfficialDate(new Date(Date.now() + 365 * 24 * 3600 * 1000));
    const verificationUrl = `${baseUrl}/verify/${empId}`;
    const qrCodeDataUrl = employee.qrCodeDataUrl || (await QRCode.toDataURL(verificationUrl, { margin: 1, width: 250 }));

    const pdfBuffer = await buildContractLetterPdf({
      agreementReference,
      executionDateStr: todayStr,
      effectiveDateStr,
      contractEndDateStr,
      employeeName: empName,
      employeeId: empId,
      address: employee.workLocation || "Rampur, Uttar Pradesh, India",
      designation,
      department,
      subject: input.assignedSubject || user.teacher?.subjects?.[0] || undefined,
      engagementType: "FULL_TIME",
      assignedBatch: input.assignedBatch || employee.assignedBatch || "Comprehensive NEET / JEE Academic Batches",
      workLocation: input.workLocation || employee.workLocation || "Rampur, Uttar Pradesh, India / Digital Studio",
      reportingAuthority: input.reportingAuthority || "Founder & Director",
      workingSchedule: "Monday to Saturday, Scheduled Live Academic Sessions",
      monthlySalary: input.monthlySalary || "45,000",
      annualSalary: input.annualSalary || "5,40,000",
      teachingHoursMonthly: "70 to 80 Hours",
      paymentCycleDay: "7th of each calendar month",
      noticePeriodDays: input.noticePeriodDays || "60 Days",
      specialConditions: input.specialConditions || "Standard institutional academic benchmarks apply.",
      qrCodeDataUrl,
      verificationUrl,
    });

    return {
      pdfBuffer,
      filename: `Atomic-Pathshala-Contract-Agreement-${safeName}-${empId}.pdf`,
      title: `Service Agreement & Contract Terms — ${empName}`,
    };
  }

  throw new Error("Unsupported document type for PDF generation");
}

/**
 * Sends the individual document or custom email to the target person via Email or WhatsApp
 */
export async function sendIndividualDocument(input: IndividualDocPayload): Promise<{
  success: boolean;
  channel: "email" | "whatsapp";
  recipient: { name: string; email?: string | null; phone?: string | null };
  documentTitle: string;
  message: string;
}> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    include: { teacher: true, student: true, role: true },
  });
  if (!user) throw new Error("User not found");

  const baseUrl = getAppBaseUrl();
  const recipientName = user.name || "Colleague / Student";
  const toEmail = user.email && user.email.includes("@") ? user.email.trim() : null;
  const toPhone = user.phone ? sanitizeIndianPhoneNumber(user.phone) : null;

  // Render PDF attachment if not a plain text custom email
  let pdfResult: { pdfBuffer: Buffer; filename: string; title: string } | null = null;
  if (input.documentType !== "CUSTOM_EMAIL" || input.customMessage?.includes("[attach_id_card]")) {
    try {
      pdfResult = await buildIndividualDocumentPdf(input);
    } catch (e: any) {
      if (input.documentType !== "CUSTOM_EMAIL") throw e;
    }
  }

  const documentTitle = pdfResult?.title || (input.documentType === "CUSTOM_EMAIL" ? "Official Notice" : input.documentType);

  // 1. Email Channel
  if (input.channel === "email") {
    if (!toEmail) throw new Error(`Recipient ${recipientName} does not have a valid email address on file.`);

    let subject = input.customSubject?.trim();
    let htmlBody = "";
    let plainText = "";

    switch (input.documentType) {
      case "ID_CARD": {
        const mail = idCardEmail({ mode: "card", kind: input.kind, name: recipientName, baseUrl });
        subject = subject || mail.subject;
        htmlBody = mail.html;
        plainText = mail.text;
        break;
      }
      case "JOINING_LETTER": {
        subject = subject || `Official Appointment & Joining Confirmation Letter — Atomic Pathshala Education (${recipientName})`;
        htmlBody = `<!doctype html><html><body style="margin:0;background:#eef4ff;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef4ff;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.06)">
<tr><td style="background:#0f3a9e;padding:20px 24px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td><img src="${baseUrl}/brand/logo.png" width="46" height="46" alt="Logo" style="display:block;border-radius:10px;background:#ffffff"/></td>
    <td style="padding-left:14px;color:#ffffff"><div style="font-size:20px;font-weight:700">Atomic Pathshala Education</div><div style="font-size:12px;color:#cfe0ff">Learn • Explore • Excel</div></td>
  </tr></table>
</td></tr>
<tr><td style="padding:28px 24px;font-size:15px;line-height:1.6">
  <p style="margin:0 0 14px">Dear <b>${recipientName}</b>,</p>
  <p style="margin:0 0 16px">We are pleased to formally confirm your appointment with <b>Atomic Pathshala Education</b>. Your official, digitally signed <b>Joining Confirmation Letter</b> has been approved by the Directorate and is attached to this email as a verifiable PDF.</p>
  
  <div style="background:#f8fafc;border-left:4px solid #1456C0;padding:14px 16px;border-radius:8px;margin:0 0 20px">
    <div style="font-size:13px;color:#475569;margin-bottom:4px">DOCUMENT SUMMARY</div>
    <div style="font-size:15px;font-weight:700;color:#0f172a">${documentTitle}</div>
    <div style="font-size:13px;color:#334155;margin-top:4px">Designation: <b>${input.designation || user.position || "Faculty"}</b> · Date of Joining: <b>${formatOfficialDate(input.joiningDate || user.contractStart || new Date())}</b></div>
  </div>

  ${input.customMessage ? `<div style="margin:0 0 20px;padding:12px 16px;background:#fff7ed;border-radius:8px;border:1px solid #fdba74;color:#7c2d12">${input.customMessage.replace(/\n/g, "<br/>")}</div>` : ""}

  <p style="margin:0 0 16px">Please find your official PDF attached below. You may print it or maintain it digitally for your institutional records.</p>
  <p style="margin:24px 0 0;font-size:14px;color:#475569">Warm regards,<br/><b>Academic Directorate & HR</b><br/>Atomic Pathshala Education</p>
</td></tr>
<tr><td style="padding:14px 24px;background:#f8fafc;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0">Atomic Pathshala Education · Official Communications · Confidential</td></tr>
</table></td></tr></table></body></html>`;
        plainText = `Dear ${recipientName},\n\nWe are pleased to formally confirm your appointment with Atomic Pathshala Education. Your official Joining Confirmation Letter is attached.\n\nWarm regards,\nAtomic Pathshala Education`;
        break;
      }
      case "EXPERIENCE_CERTIFICATE": {
        subject = subject || `Official Experience & Service Certificate — Atomic Pathshala Education (${recipientName})`;
        htmlBody = `<!doctype html><html><body style="margin:0;background:#eef4ff;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef4ff;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#0f3a9e;padding:20px 24px;color:#ffffff"><div style="font-size:20px;font-weight:700">Atomic Pathshala Education</div><div style="font-size:12px;color:#cfe0ff">Official Certification Directorate</div></td></tr>
<tr><td style="padding:28px 24px;font-size:15px;line-height:1.6">
  <p style="margin:0 0 14px">Dear <b>${recipientName}</b>,</p>
  <p style="margin:0 0 16px">Please find attached your official, digitally verified <b>Experience & Service Certificate</b> issued by Atomic Pathshala Education.</p>
  <div style="background:#f8fafc;border-left:4px solid #1456C0;padding:14px 16px;border-radius:8px;margin:0 0 20px">
    <div style="font-size:15px;font-weight:700;color:#0f172a">${documentTitle}</div>
    <div style="font-size:13px;color:#334155;margin-top:4px">Designation: <b>${input.designation || user.position || "Faculty"}</b></div>
  </div>
  ${input.customMessage ? `<p style="margin:0 0 16px">${input.customMessage.replace(/\n/g, "<br/>")}</p>` : ""}
  <p style="margin:20px 0 0;font-size:14px;color:#475569">Best wishes for your future endeavors,<br/><b>Atomic Pathshala Education</b></p>
</td></tr>
</table></td></tr></table></body></html>`;
        plainText = `Dear ${recipientName},\n\nPlease find attached your official Experience Certificate issued by Atomic Pathshala Education.\n\nAtomic Pathshala Education`;
        break;
      }
      case "RELIEVING_LETTER": {
        subject = subject || `Official Relieving Letter — Atomic Pathshala Education (${recipientName})`;
        htmlBody = `<!doctype html><html><body style="margin:0;background:#eef4ff;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef4ff;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#0f3a9e;padding:20px 24px;color:#ffffff"><div style="font-size:20px;font-weight:700">Atomic Pathshala Education</div></td></tr>
<tr><td style="padding:28px 24px;font-size:15px;line-height:1.6">
  <p style="margin:0 0 14px">Dear <b>${recipientName}</b>,</p>
  <p style="margin:0 0 16px">This is to officially confirm your relieving from your duties at Atomic Pathshala Education. Your signed Relieving Letter is attached to this email.</p>
  ${input.customMessage ? `<p style="margin:0 0 16px">${input.customMessage.replace(/\n/g, "<br/>")}</p>` : ""}
  <p style="margin:20px 0 0;font-size:14px;color:#475569">Warm regards,<br/><b>Human Resources & Administration</b><br/>Atomic Pathshala Education</p>
</td></tr>
</table></td></tr></table></body></html>`;
        plainText = `Dear ${recipientName},\n\nYour official Relieving Letter from Atomic Pathshala Education is attached.\n\nAtomic Pathshala Education`;
        break;
      }
      case "CONTRACT_LETTER": {
        subject = subject || `Executed Service Agreement & Contract Letter — Atomic Pathshala Education (${recipientName})`;
        htmlBody = `<!doctype html><html><body style="margin:0;background:#eef4ff;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef4ff;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#0f3a9e;padding:20px 24px;color:#ffffff"><div style="font-size:20px;font-weight:700">Atomic Pathshala Education</div><div style="font-size:12px;color:#cfe0ff">Institutional Service Agreements</div></td></tr>
<tr><td style="padding:28px 24px;font-size:15px;line-height:1.6">
  <p style="margin:0 0 14px">Dear <b>${recipientName}</b>,</p>
  <p style="margin:0 0 16px">Your official Service Agreement and Engagement Contract has been executed. Please find the complete verifiable PDF attached.</p>
  ${input.customMessage ? `<p style="margin:0 0 16px">${input.customMessage.replace(/\n/g, "<br/>")}</p>` : ""}
  <p style="margin:20px 0 0;font-size:14px;color:#475569">Warm regards,<br/><b>Directorate of Academic Operations</b><br/>Atomic Pathshala Education</p>
</td></tr>
</table></td></tr></table></body></html>`;
        plainText = `Dear ${recipientName},\n\nYour executed Service Agreement is attached.\n\nAtomic Pathshala Education`;
        break;
      }
      default: {
        // CUSTOM_EMAIL
        subject = subject || `Official Communication from Atomic Pathshala — ${recipientName}`;
        htmlBody = `<!doctype html><html><body style="margin:0;background:#eef4ff;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef4ff;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#0f3a9e;padding:20px 24px;color:#ffffff"><div style="font-size:20px;font-weight:700">Atomic Pathshala</div></td></tr>
<tr><td style="padding:28px 24px;font-size:15px;line-height:1.6">
  <p style="margin:0 0 14px">Dear <b>${recipientName}</b>,</p>
  <div style="margin:0 0 20px">${(input.customMessage || "Please find the official document attached.").replace(/\n/g, "<br/>")}</div>
  <p style="margin:20px 0 0;font-size:14px;color:#475569">Warm regards,<br/><b>Atomic Pathshala Administration</b></p>
</td></tr>
</table></td></tr></table></body></html>`;
        plainText = `Dear ${recipientName},\n\n${input.customMessage || "Official communication from Atomic Pathshala."}\n\nAtomic Pathshala`;
        break;
      }
    }

    const idempotencyKey = `indiv_doc:${input.documentType}:${user.id}:${Date.now()}`;
    const sent = await dispatchEmail({
      idempotencyKey,
      to: toEmail,
      recipientName,
      recipientUserId: user.id,
      recipientType: input.kind === "TEAM" ? "STAFF" : "STUDENT",
      emailType: "OTHER",
      subject,
      html: htmlBody,
      text: plainText,
      attachments: pdfResult ? [{ filename: pdfResult.filename, content: pdfResult.pdfBuffer }] : undefined,
    });

    if (sent.outcome === "failed") {
      throw new Error(`Email dispatch failed: ${sent.reason}`);
    }

    return {
      success: true,
      channel: "email",
      recipient: { name: recipientName, email: toEmail, phone: user.phone },
      documentTitle,
      message: `Successfully emailed "${documentTitle}" to ${toEmail}${pdfResult ? " with attached PDF" : ""}.`,
    };
  }

  // 2. WhatsApp Channel
  if (!toPhone || !toPhone.isValid) {
    throw new Error(`Recipient ${recipientName} does not have a valid 10-digit Indian mobile number on file.`);
  }

  let docUrl: string | undefined;
  if (pdfResult) {
    const s3Key = `documents/${input.kind.toLowerCase()}/${randomHex(12)}/${pdfResult.filename}`;
    docUrl = await uploadFile({
      key: s3Key,
      body: pdfResult.pdfBuffer,
      contentType: "application/pdf",
    });
  }

  const waText = `Dear *${recipientName}*,\n\nYour *${documentTitle}* from Atomic Pathshala is ready.\n${
    docUrl ? `\n📄 Download PDF Document: ${docUrl}\n` : ""
  }${input.customMessage ? `\nNote: ${input.customMessage}\n` : ""}\nAtomic Pathshala Education`;

  await sendWhatsAppMessage({
    to: toPhone.formattedE164,
    body: waText,
  });

  return {
    success: true,
    channel: "whatsapp",
    recipient: { name: recipientName, email: toEmail, phone: toPhone.formattedNational },
    documentTitle,
    message: `Successfully sent "${documentTitle}" via WhatsApp to ${toPhone.formattedNational}.`,
  };
}

function randomHex(bytes: number) {
  return crypto.randomBytes(bytes).toString("hex");
}

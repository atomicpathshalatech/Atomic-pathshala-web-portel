import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import {
  DEFAULT_COMPANY_DETAILS,
  generateJoiningLetterId,
  compileJoiningLetterText,
  generateServiceAgreementId,
  compileServiceAgreementText,
} from "@/lib/contracts/templates";
import { generateAgreementPdf } from "./pdf-engine";
import { sendAgreementEmail, getAgreementSender } from "./email-service";
import {
  agreementInvitationEmail,
  educatorSignedNotificationEmail,
  agreementFullyExecutedEmail,
} from "./email-templates";
import { uploadFile } from "@/lib/storage";

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function getPublicAppBaseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://ap.atomicpathshala.in")
  ).replace(/\/+$/, "");
}

export type CreateAgreementDto = {
  teacherId: string;
  documentType?: "JOINING_LETTER" | "SERVICE_AGREEMENT";
  engagementType?:
    | "FULL_TIME"
    | "PART_TIME"
    | "VISITING_FACULTY"
    | "INDEPENDENT_CONSULTANT"
    | "GUEST_EDUCATOR"
    | "CONTENT_CREATOR";
  title?: string;
  designation?: string;
  subject?: string;
  annualSalary?: string;
  monthlySalary?: string;
  perLectureRate?: string;
  perHourRate?: string;
  compensationType?: string;
  teachingHoursMonthly?: string;
  doubtHoursMonthly?: string;
  noticePeriodDays?: string;
  effectiveDate?: string;
  contractEndDate?: string;
  assignedBatch?: string;
  teachingMedium?: string;
  workLocation?: string;
  reportingAuthority?: string;
  workingSchedule?: string;
  academicSession?: string;
  specialConditions?: string;
  panNumber?: string;
  address?: string;
  // e-Stamp details (optional for Service Agreements)
  stampCertificateNo?: string;
  stampDutyAmount?: string;
  stampIssuingState?: string;
  stampInstrumentCategory?: string;
  stampIssueDate?: string;
  stampFileBuffer?: Buffer;
  stampFilename?: string;
};

/**
 * Stage 1: Admin Creates Agreement / Joining Letter
 */
export async function createAgreement(
  dto: CreateAgreementDto,
  createdByUserId: string
) {
  const teacher = await prisma.teacher.findUnique({
    where: { id: dto.teacherId },
    include: { user: true },
  });
  if (!teacher) {
    throw new Error("Educator profile not found.");
  }

  const docType = dto.documentType || "SERVICE_AGREEMENT";

  // Independent sequential numbering for Joining Letter and Service Agreement
  let agreementNumber = "";
  if (docType === "JOINING_LETTER") {
    const totalLetters = await prisma.agreement.count({
      where: { documentType: "JOINING_LETTER" },
    });
    agreementNumber = generateJoiningLetterId(totalLetters + 1);
  } else {
    const totalAgreements = await prisma.agreement.count({
      where: { documentType: "SERVICE_AGREEMENT" },
    });
    agreementNumber = generateServiceAgreementId(totalAgreements + 1);
  }

  const effectiveDateStr = dto.effectiveDate?.trim() || "03 May, 2025";
  const contractEndDateStr = dto.contractEndDate?.trim() || "02 May, 2026";
  const annualSalaryStr = dto.annualSalary?.trim() || "INR 7,20,000 /- per annum";
  const monthlySalaryStr = dto.monthlySalary?.trim() || "INR 60,000 /- per month";
  const teachingHoursStr = dto.teachingHoursMonthly?.trim() || "70 to 80 Hours";
  const noticePeriodStr = dto.noticePeriodDays?.trim() || "60 Days";
  const panNumberStr = dto.panNumber?.trim() || "DTHPA7342Q";
  const addressStr = dto.address?.trim() || "Rampur, Uttar Pradesh, India";
  const workLocationStr = dto.workLocation?.trim() || "Rampur, Uttar Pradesh, India / Digital Studio";
  const designationStr = dto.designation?.trim() || `${teacher.department} Faculty`;

  let compiledText = "";
  let defaultTitle = "";

  if (docType === "JOINING_LETTER") {
    defaultTitle = dto.title || `Educator Appointment Letter — ${teacher.user.name}`;
    compiledText = compileJoiningLetterText({
      letterReference: agreementNumber,
      issueDate: effectiveDateStr,
      educatorName: teacher.user.name,
      educatorId: teacher.employeeCode,
      designation: designationStr,
      department: teacher.department,
      subject: dto.subject || teacher.department,
      engagementType: dto.engagementType || "Full-Time",
      dateOfJoining: effectiveDateStr,
      assignedBatch: dto.assignedBatch || "Comprehensive NEET / JEE Batches",
      teachingMedium: dto.teachingMedium || "English / Bilingual (Hinglish)",
      workLocation: workLocationStr,
      reportingAuthority: dto.reportingAuthority || "Founder & Proprietor",
      workingSchedule: dto.workingSchedule || "As per official Academic Timetable",
      monthlyRemuneration: monthlySalaryStr,
      email: teacher.user.email,
      phone: teacher.user.phone || undefined,
      address: addressStr,
    });
  } else {
    defaultTitle = dto.title || `Educator Service Agreement — ${teacher.user.name}`;
    compiledText = compileServiceAgreementText({
      agreementReference: agreementNumber,
      executionDate: effectiveDateStr,
      effectiveDate: effectiveDateStr,
      contractEndDate: contractEndDateStr,
      educatorName: teacher.user.name,
      educatorId: teacher.employeeCode,
      address: addressStr,
      panNumber: panNumberStr,
      email: teacher.user.email,
      phone: teacher.user.phone || "",
      designation: designationStr,
      department: teacher.department,
      subject: dto.subject || teacher.department,
      engagementType: dto.engagementType || "Full-Time",
      assignedBatch: dto.assignedBatch || "Comprehensive NEET / JEE Batches",
      teachingMedium: dto.teachingMedium || "English / Bilingual (Hinglish)",
      workLocation: workLocationStr,
      reportingAuthority: dto.reportingAuthority || "Founder & Proprietor",
      workingSchedule: dto.workingSchedule || "As per official Academic Timetable",
      academicSession: dto.academicSession || "2025-2026 Academic Session",
      compensationType: dto.compensationType || "Monthly Remuneration",
      annualSalary: annualSalaryStr,
      monthlySalary: monthlySalaryStr,
      perLectureRate: dto.perLectureRate,
      perHourRate: dto.perHourRate,
      teachingHoursMonthly: teachingHoursStr,
      doubtHoursMonthly: dto.doubtHoursMonthly || "15 Hours per month",
      noticePeriodDays: noticePeriodStr,
      paymentCycleDay: "7th of each month",
      specialConditions: dto.specialConditions,
      stampCertificateNo: dto.stampCertificateNo?.trim() || undefined,
      stampDutyAmount: dto.stampDutyAmount?.trim() || undefined,
      stampState: dto.stampIssuingState?.trim() || undefined,
    });
  }

  // Generate initial draft PDF
  const { pdfBuffer, documentHash } = await generateAgreementPdf({
    agreementNumber,
    documentType: docType,
    title: defaultTitle,
    effectiveDate: effectiveDateStr,
    educatorName: teacher.user.name,
    educatorEmail: teacher.user.email,
    educatorPhone: teacher.user.phone || "",
    educatorAddress: addressStr,
    educatorPan: panNumberStr,
    designation: designationStr,
    department: teacher.department,
    annualSalary: annualSalaryStr,
    monthlySalary: monthlySalaryStr,
    teachingHoursMonthly: teachingHoursStr,
    paymentCycleDay: "7th of each month",
    noticePeriodDays: noticePeriodStr,
    workLocation: workLocationStr,
    companyName: DEFAULT_COMPANY_DETAILS.companyName,
    companyAddress: DEFAULT_COMPANY_DETAILS.companyAddress,
    authorizedSignatoryName: DEFAULT_COMPANY_DETAILS.authorizedSignatoryName,
    authorizedSignatoryDesignation: DEFAULT_COMPANY_DETAILS.authorizedSignatoryDesignation,
    bodyText: compiledText,
    eStampPdfBuffer: dto.stampFileBuffer,
    eStampCertNo: dto.stampCertificateNo?.trim() || undefined,
    eStampState: dto.stampIssuingState?.trim() || undefined,
    eStampAmount: dto.stampDutyAmount?.trim() || undefined,
  });

  // Optional: Upload initial Draft PDF to storage
  let originalPdfPath: string | null = null;
  try {
    const key = `Agreements/Educators/${teacher.id}/${agreementNumber}/Draft_${agreementNumber}.pdf`;
    const publicUrl = await uploadFile({
      key,
      body: pdfBuffer,
      contentType: "application/pdf",
    });
    originalPdfPath = publicUrl || key;
  } catch (e) {
    console.warn("[agreement-service] Could not upload draft PDF to R2:", e);
  }

  // Database atomic transaction
  const agreement = await prisma.$transaction(async (tx) => {
    // 1. Create Agreement
    const agg = await tx.agreement.create({
      data: {
        agreementNumber,
        documentType: docType,
        engagementType: dto.engagementType || "FULL_TIME",
        title: defaultTitle,
        educatorId: teacher.id,
        status: dto.stampCertificateNo ? "STAMP_ATTACHED" : "DRAFT",
        effectiveDate: new Date(effectiveDateStr),
        expiryDate: new Date(contractEndDateStr),
        annualSalary: annualSalaryStr,
        monthlySalary: monthlySalaryStr,
        teachingHoursMonthly: teachingHoursStr,
        noticePeriodDays: noticePeriodStr,
        workLocation: workLocationStr,
        panNumber: panNumberStr,
        address: addressStr,
        assignedBatch: dto.assignedBatch || "Comprehensive NEET / JEE Batches",
        teachingMedium: dto.teachingMedium || "English / Bilingual (Hinglish)",
        reportingAuthority: dto.reportingAuthority || "Founder & Proprietor",
        workingSchedule: dto.workingSchedule || "As per official Academic Timetable",
        compensationType: dto.compensationType || "Monthly Remuneration",
        perLectureRate: dto.perLectureRate,
        perHourRate: dto.perHourRate,
        doubtHoursMonthly: dto.doubtHoursMonthly,
        academicSession: dto.academicSession || "2025-2026 Academic Session",
        specialConditions: dto.specialConditions,
        createdBy: createdByUserId,
      },
    });

    // 2. Create Initial Version
    const ver = await tx.agreementVersion.create({
      data: {
        agreementId: agg.id,
        versionNumber: 1,
        originalPdfPath,
        documentHash,
        contentSnapshot: compiledText,
        isLocked: false,
      },
    });

    await tx.agreement.update({
      where: { id: agg.id },
      data: { currentVersionId: ver.id },
    });

    // 3. Create Signers
    // Signer 1: Educator
    await tx.agreementSigner.create({
      data: {
        agreementId: agg.id,
        signerType: "EDUCATOR",
        userId: teacher.userId,
        signerName: teacher.user.name,
        signerEmail: teacher.user.email,
        signingOrder: 1,
        status: "PENDING",
      },
    });

    // Signer 2: Director / Founder
    await tx.agreementSigner.create({
      data: {
        agreementId: agg.id,
        signerType: "DIRECTOR",
        userId: createdByUserId,
        signerName: DEFAULT_COMPANY_DETAILS.authorizedSignatoryName,
        signerEmail: "agreements@atomicpathshala.in",
        signingOrder: 2,
        status: "PENDING",
      },
    });

    // 4. Attach e-Stamp if provided
    if (dto.stampCertificateNo) {
      await tx.agreementStamp.create({
        data: {
          agreementId: agg.id,
          issuingState: dto.stampIssuingState || "Uttar Pradesh",
          certificateNumber: dto.stampCertificateNo,
          instrumentCategory:
            dto.stampInstrumentCategory || "Article 5(J) Agreement",
          stampDutyAmount: dto.stampDutyAmount || "100",
          issueDate: dto.stampIssueDate ? new Date(dto.stampIssueDate) : new Date(),
          verificationStatus: "ATTACHED_UNVERIFIED",
        },
      });
    }

    // 5. Audit Log
    await tx.agreementAuditLog.create({
      data: {
        agreementId: agg.id,
        actorId: createdByUserId,
        eventType: "AGREEMENT_CREATED",
        metadata: {
          agreementNumber,
          educatorName: teacher.user.name,
          educatorEmail: teacher.user.email,
          documentHash,
        },
      },
    });

    return agg;
  });

  return agreement;
}

/**
 * Stage 2: Send Agreement Invitation to Educator
 */
export async function sendAgreementInvitation(
  agreementId: string,
  actorUserId: string,
  options?: { bypassEmailForTesting?: boolean }
) {
  const agreement = await prisma.agreement.findUnique({
    where: { id: agreementId },
    include: {
      educator: { include: { user: true } },
      signers: true,
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
    },
  });

  if (!agreement) throw new Error("Agreement not found.");

  const educatorSigner = agreement.signers.find((s) => s.signerType === "EDUCATOR");
  if (!educatorSigner) throw new Error("Educator signer record not found.");

  // Generate secure single-use token
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Expire any existing active invitations for this signer to avoid duplicates
  await prisma.agreementInvitation.updateMany({
    where: { agreementId: agreement.id, signerId: educatorSigner.id, status: "ACTIVE" },
    data: { status: "REVOKED" },
  });

  // Create new active invitation
  await prisma.agreementInvitation.create({
    data: {
      agreementId: agreement.id,
      signerId: educatorSigner.id,
      tokenHash,
      expiresAt,
      status: "ACTIVE",
    },
  });

  const baseUrl = getPublicAppBaseUrl();
  const reviewUrl = `${baseUrl}/agreements/sign/${rawToken}`;

  const { subject, html, text } = agreementInvitationEmail({
    educatorName: educatorSigner.signerName,
    agreementTitle: agreement.title,
    agreementNumber: agreement.agreementNumber,
    reviewUrl,
    expiresAt,
  });

  if (options?.bypassEmailForTesting) {
    await prisma.agreementEmailLog.create({
      data: {
        agreementId: agreement.id,
        recipient: educatorSigner.signerEmail,
        emailType: "INVITATION",
        providerMessageId: "SIMULATED_TEST",
        status: "DELIVERED",
        metadata: {
          recipientName: educatorSigner.signerName,
          subject,
          provider: "SIMULATED_TEST",
        },
      },
    });

    await prisma.agreement.update({
      where: { id: agreement.id },
      data: { status: "SENT_TO_EDUCATOR" },
    });

    await prisma.agreementAuditLog.create({
      data: {
        agreementId: agreement.id,
        actorId: actorUserId,
        eventType: "INVITATION_SENT",
        metadata: {
          recipientEmail: educatorSigner.signerEmail,
          invitationExpiresAt: expiresAt.toISOString(),
          provider: "SIMULATED_TEST",
        },
      },
    });

    return {
      success: true,
      token: rawToken,
      reviewUrl,
      status: "SENT_TO_EDUCATOR",
      provider: "SIMULATED_TEST",
    };
  }

  // Send the email
  const sendResult = await sendAgreementEmail({
    agreementId: agreement.id,
    recipientEmail: educatorSigner.signerEmail,
    recipientName: educatorSigner.signerName,
    emailType: "INVITATION",
    subject,
    html,
    text,
  });

  if (!sendResult.delivered) {
    await prisma.agreement.update({
      where: { id: agreement.id },
      data: { status: "EMAIL_DELIVERY_FAILED" },
    });

    await prisma.agreementAuditLog.create({
      data: {
        agreementId: agreement.id,
        actorId: actorUserId,
        eventType: "EMAIL_DELIVERY_FAILED",
        metadata: {
          recipient: educatorSigner.signerEmail,
          provider: sendResult.provider,
          error: sendResult.error,
        },
      },
    });

    throw new Error(
      `Email transmission failed: ${sendResult.error || "Mail server error"}. Please check email settings.`
    );
  }

  // Success: Update status to SENT_TO_EDUCATOR
  await prisma.agreement.update({
    where: { id: agreement.id },
    data: { status: "SENT_TO_EDUCATOR" },
  });

  await prisma.agreementSigner.update({
    where: { id: educatorSigner.id },
    data: { status: "INVITED" },
  });

  // Lock the current document version
  if (agreement.currentVersionId) {
    await prisma.agreementVersion.update({
      where: { id: agreement.currentVersionId },
      data: { isLocked: true },
    }).catch(() => {});
  }

  await prisma.agreementAuditLog.create({
    data: {
      agreementId: agreement.id,
      actorId: actorUserId,
      eventType: "INVITATION_SENT",
      metadata: {
        recipient: educatorSigner.signerEmail,
        provider: sendResult.provider,
        messageId: sendResult.messageId,
      },
    },
  });

  return { success: true, reviewUrl };
}

/**
 * Stage 3 & 4: Educator Opens Invitation Link
 */
export async function getAgreementByInvitationToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);

  const invitation = await prisma.agreementInvitation.findUnique({
    where: { tokenHash },
    include: {
      agreement: {
        include: {
          educator: { include: { user: true } },
          stamp: true,
          signers: true,
          versions: { orderBy: { versionNumber: "desc" }, take: 1 },
        },
      },
      signer: true,
    },
  });

  if (!invitation) {
    return { valid: false, error: "Invalid invitation token." };
  }

  if (invitation.status === "REVOKED") {
    return { valid: false, error: "This invitation link was superseded or revoked." };
  }

  if (invitation.status === "CONSUMED" || invitation.consumedAt) {
    return { valid: false, error: "This agreement has already been electronically signed." };
  }

  if (invitation.expiresAt < new Date()) {
    return { valid: false, error: "This invitation link has expired. Please contact support." };
  }

  // Update status to VIEWED_BY_EDUCATOR if still in SENT_TO_EDUCATOR
  if (invitation.agreement.status === "SENT_TO_EDUCATOR") {
    await prisma.agreement.update({
      where: { id: invitation.agreementId },
      data: { status: "VIEWED_BY_EDUCATOR" },
    }).catch(() => {});

    await prisma.agreementSigner.update({
      where: { id: invitation.signerId },
      data: { status: "VIEWED" },
    }).catch(() => {});

    await prisma.agreementAuditLog.create({
      data: {
        agreementId: invitation.agreementId,
        eventType: "VIEWED_BY_EDUCATOR",
        metadata: { signerEmail: invitation.signer.signerEmail },
      },
    }).catch(() => {});
  }

  return {
    valid: true,
    agreement: invitation.agreement,
    signer: invitation.signer,
    currentVersion: invitation.agreement.versions[0] || null,
  };
}

/**
 * Stage 5 & 6: Educator Submits Signature
 */
export async function submitEducatorSignature(params: {
  rawToken: string;
  signedName: string;
  signatureDataUrl?: string;
  signatureMethod: "ELECTRONIC_DRAWN" | "ELECTRONIC_TYPED" | "ELECTRONIC_UPLOADED";
  ipAddress: string;
  userAgent?: string;
}) {
  const tokenHash = hashToken(params.rawToken);

  const invitation = await prisma.agreementInvitation.findUnique({
    where: { tokenHash },
    include: {
      agreement: {
        include: {
          educator: { include: { user: true } },
          signers: true,
          versions: { orderBy: { versionNumber: "desc" }, take: 1 },
        },
      },
      signer: true,
    },
  });

  if (!invitation || invitation.status !== "ACTIVE" || invitation.consumedAt) {
    throw new Error("Invalid or already consumed invitation token.");
  }

  const currentVersion = invitation.agreement.versions[0];
  if (!currentVersion) throw new Error("Agreement document version not found.");

  // Record Signature in DB
  await prisma.$transaction(async (tx) => {
    // 1. Consume invitation
    await tx.agreementInvitation.update({
      where: { id: invitation.id },
      data: {
        consumedAt: new Date(),
        status: "CONSUMED",
      },
    });

    // 2. Create Signature record
    await tx.agreementSignature.create({
      data: {
        agreementVersionId: currentVersion.id,
        signerId: invitation.signerId,
        signatureMethod: params.signatureMethod,
        signatureDataUrl: params.signatureDataUrl,
        signerIp: params.ipAddress,
        userAgent: params.userAgent,
        signedAt: new Date(),
        documentHash: currentVersion.documentHash,
      },
    });

    // 3. Update Educator Signer status
    await tx.agreementSigner.update({
      where: { id: invitation.signerId },
      data: {
        status: "SIGNED",
        signedAt: new Date(),
        signatureMethod: params.signatureMethod,
      },
    });

    // 4. Update Agreement status -> AWAITING_DIRECTOR_SIGNATURE
    await tx.agreement.update({
      where: { id: invitation.agreementId },
      data: {
        status: "AWAITING_DIRECTOR_SIGNATURE",
      },
    });

    // 5. Audit Log
    await tx.agreementAuditLog.create({
      data: {
        agreementId: invitation.agreementId,
        actorId: invitation.signer.userId,
        actorName: params.signedName,
        actorEmail: invitation.signer.signerEmail,
        actorIp: params.ipAddress,
        eventType: "EDUCATOR_SIGNED",
        metadata: {
          signatureMethod: params.signatureMethod,
          timestamp: new Date().toISOString(),
        },
      },
    });
  });

  // Notify Director via email
  try {
    const baseUrl = getPublicAppBaseUrl();
    const countersignUrl = `${baseUrl}/team/contracts/${invitation.agreementId}`;

    const { subject, html, text } = educatorSignedNotificationEmail({
      educatorName: params.signedName,
      agreementTitle: invitation.agreement.title,
      agreementNumber: invitation.agreement.agreementNumber,
      signedAt: new Date(),
      countersignUrl,
    });

    await sendAgreementEmail({
      agreementId: invitation.agreementId,
      recipientEmail: "agreements@atomicpathshala.in",
      recipientName: DEFAULT_COMPANY_DETAILS.authorizedSignatoryName,
      emailType: "EDUCATOR_SIGNED_NOTIFICATION",
      subject,
      html,
      text,
    });
  } catch (notifyErr) {
    console.warn("[agreement-service] Director notification email warning:", notifyErr);
  }

  return { success: true };
}

/**
 * Stage 7 & 8: Director Countersignature & Final PDF Assembly
 */
export async function countersignDirector(params: {
  agreementId: string;
  directorUserId: string;
  directorSignedName: string;
  signatureDataUrl?: string;
  signatureMethod?: "ELECTRONIC_DRAWN" | "ELECTRONIC_TYPED";
  ipAddress: string;
  userAgent?: string;
}) {
  const agreement = await prisma.agreement.findUnique({
    where: { id: params.agreementId },
    include: {
      educator: { include: { user: true } },
      signers: {
        include: {
          signatures: true,
        },
      },
      stamp: true,
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
    },
  });

  if (!agreement) throw new Error("Agreement not found.");

  const currentVersion = agreement.versions[0];
  if (!currentVersion) throw new Error("Agreement version not found.");

  const educatorSigner = agreement.signers.find((s) => s.signerType === "EDUCATOR");
  const educatorSignature = educatorSigner?.signatures[0];
  const directorSigner = agreement.signers.find((s) => s.signerType === "DIRECTOR");

  if (!directorSigner) throw new Error("Director signer record missing.");

  // 1. Generate Final Executed PDF
  const { pdfBuffer: finalPdfBuffer, documentHash: finalDocHash } =
    await generateAgreementPdf({
      agreementNumber: agreement.agreementNumber,
      documentType: agreement.documentType as any,
      title: agreement.title,
      effectiveDate: agreement.effectiveDate
        ? agreement.effectiveDate.toISOString().split("T")[0]
        : "03 May, 2025",
      educatorName: educatorSigner?.signerName || agreement.educator.user.name,
      educatorEmail: educatorSigner?.signerEmail || agreement.educator.user.email,
      educatorPhone: agreement.educator.user.phone || "",
      educatorAddress: agreement.address || "Rampur, Uttar Pradesh, India",
      educatorPan: agreement.panNumber || "",
      designation: `${agreement.educator.department} Faculty`,
      department: agreement.educator.department,
      annualSalary: agreement.annualSalary || "",
      monthlySalary: agreement.monthlySalary || "",
      teachingHoursMonthly: agreement.teachingHoursMonthly || "",
      paymentCycleDay: "7th of each month",
      noticePeriodDays: agreement.noticePeriodDays || "60 Days",
      workLocation: agreement.workLocation || "Rampur, Uttar Pradesh, India",
      companyName: DEFAULT_COMPANY_DETAILS.companyName,
      companyAddress: DEFAULT_COMPANY_DETAILS.companyAddress,
      authorizedSignatoryName: params.directorSignedName || "Firoz Ali",
      authorizedSignatoryDesignation: "Founder & Proprietor",
      bodyText: currentVersion.contentSnapshot,
      // e-Stamp details
      eStampCertNo: agreement.stamp?.certificateNumber,
      eStampState: agreement.stamp?.issuingState,
      eStampAmount: agreement.stamp?.stampDutyAmount,
      // Educator signature
      educatorSignatureDataUrl: educatorSignature?.signatureDataUrl || undefined,
      educatorSignedName: educatorSigner?.signerName,
      educatorSignedAt: educatorSignature?.signedAt || educatorSigner?.signedAt || new Date(),
      educatorIp: educatorSignature?.signerIp || "Verified",
      // Founder & Proprietor signature
      directorSignatureDataUrl: params.signatureDataUrl,
      directorSignedName: params.directorSignedName || "Firoz Ali",
      directorSignedAt: new Date(),
      directorIp: params.ipAddress,
    });

  // 2. Upload Final PDF to Cloudflare R2
  const educatorNameSafe = (educatorSigner?.signerName || "Faculty").replace(/[^a-zA-Z0-9_-]/g, "_");
  const docTypeFolder = agreement.documentType === "JOINING_LETTER" ? "Joining_Letters" : "Service_Agreements";
  const folder = `Documents/Educators/${educatorNameSafe}/${docTypeFolder}/${agreement.agreementNumber}`;
  const filename = `${docTypeFolder}_${agreement.agreementNumber}.pdf`;

  let finalPdfUrl: string | null = null;
  let finalPdfPath: string | null = null;

  try {
    const key = `${folder}/${filename}`;
    const publicUrl = await uploadFile({
      key,
      body: finalPdfBuffer,
      contentType: "application/pdf",
    });
    finalPdfUrl = publicUrl;
    finalPdfPath = key;
  } catch (uploadErr) {
    console.error("[agreement-service] Error uploading final PDF to R2:", uploadErr);
  }

  // 3. Atomic Database update
  await prisma.$transaction(async (tx) => {
    // Record Director signature
    await tx.agreementSignature.create({
      data: {
        agreementVersionId: currentVersion.id,
        signerId: directorSigner.id,
        signatureMethod: params.signatureMethod || "ELECTRONIC_TYPED",
        signatureDataUrl: params.signatureDataUrl,
        signerIp: params.ipAddress,
        userAgent: params.userAgent,
        signedAt: new Date(),
        documentHash: finalDocHash,
      },
    });

    // Mark Director signer as signed
    await tx.agreementSigner.update({
      where: { id: directorSigner.id },
      data: {
        status: "SIGNED",
        signedAt: new Date(),
        signatureMethod: params.signatureMethod || "ELECTRONIC_TYPED",
      },
    });

    // Mark Agreement as FULLY_EXECUTED
    await tx.agreement.update({
      where: { id: agreement.id },
      data: {
        status: "FULLY_EXECUTED",
        finalPdfPath,
        finalPdfUrl,
        finalPdfHash: finalDocHash,
      },
    });

    // Audit Log
    await tx.agreementAuditLog.create({
      data: {
        agreementId: agreement.id,
        actorId: params.directorUserId,
        actorName: params.directorSignedName,
        actorIp: params.ipAddress,
        eventType: "FULLY_EXECUTED",
        metadata: {
          finalDocHash,
          finalPdfPath,
          timestamp: new Date().toISOString(),
        },
      },
    });
  });

  // 4. Send Final Executed PDF Email to Educator & Director
  const effectiveDateFormatted = agreement.effectiveDate
    ? agreement.effectiveDate.toLocaleDateString("en-IN", { dateStyle: "long" })
    : "Immediate";

  // Email to Educator
  try {
    const { subject, html, text } = agreementFullyExecutedEmail({
      recipientName: educatorSigner?.signerName || "Educator",
      agreementTitle: agreement.title,
      agreementNumber: agreement.agreementNumber,
      effectiveDate: effectiveDateFormatted,
      downloadUrl: finalPdfUrl || undefined,
    });

    await sendAgreementEmail({
      agreementId: agreement.id,
      recipientEmail: educatorSigner?.signerEmail || agreement.educator.user.email,
      recipientName: educatorSigner?.signerName || "Educator",
      emailType: "FINAL_EXECUTED",
      subject,
      html,
      text,
      attachments: [
        {
          filename: `Atomic_Pathshala_${agreement.agreementNumber}.pdf`,
          content: finalPdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });
  } catch (eduMailErr) {
    console.warn("[agreement-service] Final PDF delivery to educator failed:", eduMailErr);
  }

  // Email to Director
  try {
    const { subject, html, text } = agreementFullyExecutedEmail({
      recipientName: DEFAULT_COMPANY_DETAILS.authorizedSignatoryName,
      agreementTitle: agreement.title,
      agreementNumber: agreement.agreementNumber,
      effectiveDate: effectiveDateFormatted,
      downloadUrl: finalPdfUrl || undefined,
    });

    await sendAgreementEmail({
      agreementId: agreement.id,
      recipientEmail: "agreements@atomicpathshala.in",
      recipientName: DEFAULT_COMPANY_DETAILS.authorizedSignatoryName,
      emailType: "FINAL_EXECUTED",
      subject,
      html,
      text,
      attachments: [
        {
          filename: `Atomic_Pathshala_${agreement.agreementNumber}.pdf`,
          content: finalPdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });
  } catch (dirMailErr) {
    console.warn("[agreement-service] Final PDF delivery to Director failed:", dirMailErr);
  }

  return {
    success: true,
    finalPdfUrl,
    finalDocHash,
  };
}

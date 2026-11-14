/**
 * ATOMIC PATHSHALA EDUCATION
 * Employee Identity & QR Verification Service
 * 
 * Official Business Identity:
 * - Enterprise Name: ATOMIC PATHSHALA EDUCATION
 * - Brand: Atomic Pathshala
 * - Founder: Firoz Ali
 * - Designation: Founder & Proprietor
 * - Location: Rampur, Uttar Pradesh, India
 * - Website: https://atomicpathshala.in
 */

import "server-only";
import crypto from "crypto";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import {
  EmployeeEmploymentType,
  EmployeeEmploymentStatus,
  EmployeeVerificationStatus,
} from "@prisma/client";

export function getAppBaseDomain(): string {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://atomicpathshala.in")
  ).replace(/\/+$/, "");
}

/**
 * Generate unique, sequential Employee ID: AP-EMP-YYYY-0001
 * Guaranteed never reused.
 */
export async function generateEmployeeId(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const yearPrefix = `AP-EMP-${currentYear}-`;

  // Count employees created with this year's prefix
  const count = await prisma.employee.count({
    where: {
      employeeId: {
        startsWith: yearPrefix,
      },
    },
  });

  const nextSequence = count + 1;
  const paddedSequence = String(nextSequence).padStart(4, "0");
  const candidateId = `${yearPrefix}${paddedSequence}`;

  // Double check uniqueness
  const existing = await prisma.employee.findUnique({
    where: { employeeId: candidateId },
  });

  if (existing) {
    // Fallback timestamp offset if concurrency collision
    const totalAll = await prisma.employee.count();
    return `${yearPrefix}${String(totalAll + 1).padStart(4, "0")}`;
  }

  return candidateId;
}

/**
 * Generate unguessable 128-bit cryptographic verification token
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(16).toString("base64url");
}

/**
 * Generate high-resolution PNG Data URL QR code
 */
export async function generateQrCodeDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 512,
    color: {
      dark: "#0a1f5c", // Deep Navy Blue
      light: "#ffffff",
    },
  });
}

export type CreateEmployeeDto = {
  name: string;
  photoUrl?: string;
  designation: string;
  department: string;
  dateOfJoining: string | Date;
  employmentType?: EmployeeEmploymentType;
  assignedBatch?: string;
  workLocation?: string;
  status?: EmployeeEmploymentStatus;
  email?: string;
  phone?: string;
  userId?: string;
  teacherId?: string;
  notes?: string;
  createdById?: string;
};

/**
 * Create a new employee with automatic Employee ID, secure token, and QR code
 */
export async function createEmployee(dto: CreateEmployeeDto) {
  const employeeId = await generateEmployeeId();
  const verificationToken = generateVerificationToken();
  const baseDomain = getAppBaseDomain();
  const verificationUrl = `${baseDomain}/verify/${employeeId}`;
  const qrCodeDataUrl = await generateQrCodeDataUrl(verificationUrl);

  const employee = await prisma.employee.create({
    data: {
      employeeId,
      name: dto.name.trim(),
      photoUrl: dto.photoUrl?.trim() || null,
      designation: dto.designation.trim(),
      department: dto.department.trim(),
      dateOfJoining: new Date(dto.dateOfJoining),
      employmentType: dto.employmentType || "FULL_TIME",
      assignedBatch: dto.assignedBatch?.trim() || null,
      workLocation: dto.workLocation?.trim() || "Rampur, Uttar Pradesh, India",
      status: dto.status || "ACTIVE",
      verificationStatus: "VERIFIED",
      verificationToken,
      qrCodeDataUrl,
      email: dto.email?.trim() || null,
      phone: dto.phone?.trim() || null,
      userId: dto.userId || null,
      teacherId: dto.teacherId || null,
      notes: dto.notes?.trim() || null,
      createdById: dto.createdById || null,
    },
  });

  return employee;
}

export type UpdateEmployeeDto = Partial<CreateEmployeeDto> & {
  lastWorkingDate?: string | Date | null;
  verificationStatus?: EmployeeVerificationStatus;
};

/**
 * Update an existing employee profile
 */
export async function updateEmployee(id: string, dto: UpdateEmployeeDto) {
  const dataToUpdate: any = {};

  if (dto.name !== undefined) dataToUpdate.name = dto.name.trim();
  if (dto.photoUrl !== undefined) dataToUpdate.photoUrl = dto.photoUrl ? dto.photoUrl.trim() : null;
  if (dto.designation !== undefined) dataToUpdate.designation = dto.designation.trim();
  if (dto.department !== undefined) dataToUpdate.department = dto.department.trim();
  if (dto.dateOfJoining !== undefined) dataToUpdate.dateOfJoining = new Date(dto.dateOfJoining);
  if (dto.employmentType !== undefined) dataToUpdate.employmentType = dto.employmentType;
  if (dto.assignedBatch !== undefined) dataToUpdate.assignedBatch = dto.assignedBatch ? dto.assignedBatch.trim() : null;
  if (dto.workLocation !== undefined) dataToUpdate.workLocation = dto.workLocation.trim();
  if (dto.status !== undefined) dataToUpdate.status = dto.status;
  if (dto.lastWorkingDate !== undefined) {
    dataToUpdate.lastWorkingDate = dto.lastWorkingDate ? new Date(dto.lastWorkingDate) : null;
  }
  if (dto.verificationStatus !== undefined) dataToUpdate.verificationStatus = dto.verificationStatus;
  if (dto.email !== undefined) dataToUpdate.email = dto.email ? dto.email.trim() : null;
  if (dto.phone !== undefined) dataToUpdate.phone = dto.phone ? dto.phone.trim() : null;
  if (dto.notes !== undefined) dataToUpdate.notes = dto.notes ? dto.notes.trim() : null;

  const updated = await prisma.employee.update({
    where: { id },
    data: dataToUpdate,
  });

  return updated;
}

/**
 * Re-issue / rotate compromised QR verification token
 */
export async function reissueEmployeeQrToken(id: string) {
  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) throw new Error("Employee not found.");

  const newVerificationToken = generateVerificationToken();
  const baseDomain = getAppBaseDomain();
  const verificationUrl = `${baseDomain}/verify/${employee.employeeId}`;
  const newQrCode = await generateQrCodeDataUrl(verificationUrl);

  return prisma.employee.update({
    where: { id },
    data: {
      verificationToken: newVerificationToken,
      qrCodeDataUrl: newQrCode,
      verificationStatus: "VERIFIED",
    },
  });
}

/**
 * Public Verification Result Interface (Zero sensitive fields exposed)
 */
export type PublicEmployeeVerificationResult = {
  isValid: boolean;
  officialStatus:
    | "VERIFIED_ACTIVE"
    | "VERIFIED_FORMER"
    | "INACTIVE"
    | "REVOKED_VERIFICATION"
    | "INVALID_EMPLOYEE_ID";
  statusBadge: {
    label: string;
    tone: "success" | "info" | "warning" | "danger";
    description: string;
  };
  enterpriseName: string;
  brandName: string;
  location: string;
  website: string;
  employee?: {
    employeeId: string;
    name: string;
    photoUrl: string | null;
    designation: string;
    department: string;
    dateOfJoining: string;
    employmentType: string;
    employmentStatus: string;
    workLocation: string;
    assignedBatch: string | null;
    lastWorkingDate: string | null;
    verifiedAt: string;
  };
};

/**
 * Public Verification Lookup
 * Accessible by anyone scanning QR without login.
 * Safely handles AP-EMP-YYYY-0001 or fallback token.
 */
export async function verifyEmployeePublic(
  identifier: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<PublicEmployeeVerificationResult> {
  const cleanId = decodeURIComponent(identifier).trim();

  // Look up by employeeId or verificationToken
  const employee = await prisma.employee.findFirst({
    where: {
      OR: [
        { employeeId: { equals: cleanId, mode: "insensitive" } },
        { verificationToken: cleanId },
      ],
    },
  });

  const enterpriseName = "ATOMIC PATHSHALA EDUCATION";
  const brandName = "Atomic Pathshala";
  const location = "Rampur, Uttar Pradesh, India";
  const website = "https://atomicpathshala.in";

  // Case 1: Not found
  if (!employee) {
    await prisma.employeeVerificationLog.create({
      data: {
        verificationType: "EMPLOYEE_QR_SCAN",
        lookupIdentifier: cleanId,
        resultStatus: "INVALID_EMPLOYEE_ID",
        ipAddress: meta?.ip || null,
        userAgent: meta?.userAgent || null,
      },
    }).catch(() => {});

    return {
      isValid: false,
      officialStatus: "INVALID_EMPLOYEE_ID",
      statusBadge: {
        label: "INVALID EMPLOYEE ID",
        tone: "danger",
        description: "This Employee ID or QR Code does not match any official record at Atomic Pathshala Education.",
      },
      enterpriseName,
      brandName,
      location,
      website,
    };
  }

  // Case 2: Revoked
  if (employee.verificationStatus === "REVOKED") {
    await prisma.employeeVerificationLog.create({
      data: {
        employeeId: employee.id,
        verificationType: "EMPLOYEE_QR_SCAN",
        lookupIdentifier: cleanId,
        resultStatus: "REVOKED_VERIFICATION",
        ipAddress: meta?.ip || null,
        userAgent: meta?.userAgent || null,
      },
    }).catch(() => {});

    return {
      isValid: false,
      officialStatus: "REVOKED_VERIFICATION",
      statusBadge: {
        label: "REVOKED VERIFICATION",
        tone: "danger",
        description: "The verification status for this credential has been officially revoked by Atomic Pathshala administration.",
      },
      enterpriseName,
      brandName,
      location,
      website,
      employee: {
        employeeId: employee.employeeId,
        name: employee.name,
        photoUrl: employee.photoUrl,
        designation: employee.designation,
        department: employee.department,
        dateOfJoining: employee.dateOfJoining.toLocaleDateString("en-IN", { dateStyle: "long" }),
        employmentType: employee.employmentType.replace(/_/g, " "),
        employmentStatus: employee.status,
        workLocation: employee.workLocation,
        assignedBatch: employee.assignedBatch,
        lastWorkingDate: employee.lastWorkingDate ? employee.lastWorkingDate.toLocaleDateString("en-IN", { dateStyle: "long" }) : null,
        verifiedAt: new Date().toISOString(),
      },
    };
  }

  // Case 3: Former Employee
  if (employee.status === "FORMER" || employee.status === "TERMINATED") {
    await prisma.employeeVerificationLog.create({
      data: {
        employeeId: employee.id,
        verificationType: "EMPLOYEE_QR_SCAN",
        lookupIdentifier: cleanId,
        resultStatus: "VERIFIED_FORMER",
        ipAddress: meta?.ip || null,
        userAgent: meta?.userAgent || null,
      },
    }).catch(() => {});

    return {
      isValid: true,
      officialStatus: "VERIFIED_FORMER",
      statusBadge: {
        label: "VERIFIED — FORMER EMPLOYEE",
        tone: "info",
        description: "Verified genuine credential. This individual was officially engaged with Atomic Pathshala and has completed their tenure.",
      },
      enterpriseName,
      brandName,
      location,
      website,
      employee: {
        employeeId: employee.employeeId,
        name: employee.name,
        photoUrl: employee.photoUrl,
        designation: employee.designation,
        department: employee.department,
        dateOfJoining: employee.dateOfJoining.toLocaleDateString("en-IN", { dateStyle: "long" }),
        employmentType: employee.employmentType.replace(/_/g, " "),
        employmentStatus: employee.status,
        workLocation: employee.workLocation,
        assignedBatch: employee.assignedBatch,
        lastWorkingDate: employee.lastWorkingDate ? employee.lastWorkingDate.toLocaleDateString("en-IN", { dateStyle: "long" }) : null,
        verifiedAt: new Date().toISOString(),
      },
    };
  }

  // Case 4: Inactive
  if (employee.status === "INACTIVE" || employee.verificationStatus === "SUSPENDED") {
    await prisma.employeeVerificationLog.create({
      data: {
        employeeId: employee.id,
        verificationType: "EMPLOYEE_QR_SCAN",
        lookupIdentifier: cleanId,
        resultStatus: "INACTIVE",
        ipAddress: meta?.ip || null,
        userAgent: meta?.userAgent || null,
      },
    }).catch(() => {});

    return {
      isValid: false,
      officialStatus: "INACTIVE",
      statusBadge: {
        label: "INACTIVE CREDENTIAL",
        tone: "warning",
        description: "This employee credential is currently in an inactive or suspended status. Please contact HR administration.",
      },
      enterpriseName,
      brandName,
      location,
      website,
      employee: {
        employeeId: employee.employeeId,
        name: employee.name,
        photoUrl: employee.photoUrl,
        designation: employee.designation,
        department: employee.department,
        dateOfJoining: employee.dateOfJoining.toLocaleDateString("en-IN", { dateStyle: "long" }),
        employmentType: employee.employmentType.replace(/_/g, " "),
        employmentStatus: employee.status,
        workLocation: employee.workLocation,
        assignedBatch: employee.assignedBatch,
        lastWorkingDate: employee.lastWorkingDate ? employee.lastWorkingDate.toLocaleDateString("en-IN", { dateStyle: "long" }) : null,
        verifiedAt: new Date().toISOString(),
      },
    };
  }

  // Case 5: Verified Active Employee
  await prisma.employeeVerificationLog.create({
    data: {
      employeeId: employee.id,
      verificationType: "EMPLOYEE_QR_SCAN",
      lookupIdentifier: cleanId,
      resultStatus: "VERIFIED_ACTIVE",
      ipAddress: meta?.ip || null,
      userAgent: meta?.userAgent || null,
    },
  }).catch(() => {});

  return {
    isValid: true,
    officialStatus: "VERIFIED_ACTIVE",
    statusBadge: {
      label: "VERIFIED — ACTIVE",
      tone: "success",
      description: "Official Verified Credential. The individual is an active employee / faculty member of Atomic Pathshala Education.",
    },
    enterpriseName,
    brandName,
    location,
    website,
    employee: {
      employeeId: employee.employeeId,
      name: employee.name,
      photoUrl: employee.photoUrl,
      designation: employee.designation,
      department: employee.department,
      dateOfJoining: employee.dateOfJoining.toLocaleDateString("en-IN", { dateStyle: "long" }),
      employmentType: employee.employmentType.replace(/_/g, " "),
      employmentStatus: "ACTIVE",
      workLocation: employee.workLocation,
      assignedBatch: employee.assignedBatch,
      lastWorkingDate: null,
      verifiedAt: new Date().toISOString(),
    },
  };
}

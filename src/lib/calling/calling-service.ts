import { prisma } from "@/lib/db";
import {
  CallingRequestStatus,
  CallingSimPreference,
  CRMCallOutcome,
  CRMActivityType,
} from "@prisma/client";
import { sendPushToTokens } from "@/lib/notifications/fcm";
import crypto from "crypto";

const HEARTBEAT_OFFLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Generate secure 6-digit pairing code and QR payload for device pairing
 */
export async function generateDevicePairingCode(userId: string) {
  const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  // Store temporary placeholder device or associate with code
  const tempDevice = await prisma.callingDevice.create({
    data: {
      deviceName: "New Android Handset",
      deviceIdentifier: `PENDING-${pairingCode}-${Date.now().toString(36)}`,
      pairingCode,
      pairingCodeExp: expiresAt,
      assignedUserId: userId,
      isActive: true,
      isOnline: false,
    },
  });

  const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "https://ap.atomicpathshala.in";

  const qrPayload = JSON.stringify({
    serverUrl: appUrl,
    pairingCode,
    expiresAt: expiresAt.toISOString(),
  });

  return {
    deviceId: tempDevice.id,
    pairingCode,
    expiresAt: expiresAt.toISOString(),
    qrPayload,
  };
}

/**
 * Android companion app pairs using 6-digit code or QR code payload
 */
export async function registerDeviceFromApp(params: {
  pairingCode: string;
  deviceIdentifier: string;
  deviceName: string;
  fcmToken?: string;
  androidVersion?: string;
  appVersion?: string;
  batteryLevel?: number;
  networkType?: string;
  sim1Carrier?: string;
  sim1Number?: string;
  sim2Carrier?: string;
  sim2Number?: string;
}) {
  const pendingDevice = await prisma.callingDevice.findFirst({
    where: {
      pairingCode: params.pairingCode,
      pairingCodeExp: { gt: new Date() },
    },
  });

  if (!pendingDevice) {
    throw new Error("Invalid or expired pairing code. Please generate a new code from the CRM.");
  }

  // Update device record with actual hardware identity
  const device = await prisma.callingDevice.update({
    where: { id: pendingDevice.id },
    data: {
      deviceName: params.deviceName || "Atomic Calling Handset",
      deviceIdentifier: params.deviceIdentifier,
      fcmToken: params.fcmToken,
      pairingCode: null, // Consume code
      pairingCodeExp: null,
      androidVersion: params.androidVersion,
      appVersion: params.appVersion,
      batteryLevel: params.batteryLevel,
      networkType: params.networkType,
      sim1Carrier: params.sim1Carrier,
      sim1Number: params.sim1Number,
      sim2Carrier: params.sim2Carrier,
      sim2Number: params.sim2Number,
      isActive: true,
      isOnline: true,
      lastHeartbeat: new Date(),
    },
  });

  // Log activity
  await prisma.callingActivityLog.create({
    data: {
      deviceId: device.id,
      eventType: "DEVICE_PAIRED",
      metadata: {
        deviceName: device.deviceName,
        androidVersion: device.androidVersion,
        sim1: device.sim1Carrier,
        sim2: device.sim2Carrier,
      },
    },
  });

  return {
    success: true,
    deviceId: device.id,
    deviceName: device.deviceName,
    assignedUserId: device.assignedUserId,
  };
}

/**
 * Heartbeat keepalive sent periodically from Android app
 */
export async function recordDeviceHeartbeat(params: {
  deviceId: string;
  fcmToken?: string;
  batteryLevel?: number;
  networkType?: string;
  sim1Carrier?: string;
  sim2Carrier?: string;
}) {
  const device = await prisma.callingDevice.findUnique({
    where: { id: params.deviceId },
  });

  if (!device || !device.isActive) {
    return { success: false, error: "Device not found or inactive" };
  }

  await prisma.callingDevice.update({
    where: { id: params.deviceId },
    data: {
      isOnline: true,
      lastHeartbeat: new Date(),
      fcmToken: params.fcmToken || device.fcmToken,
      batteryLevel: params.batteryLevel !== undefined ? params.batteryLevel : device.batteryLevel,
      networkType: params.networkType || device.networkType,
      sim1Carrier: params.sim1Carrier || device.sim1Carrier,
      sim2Carrier: params.sim2Carrier || device.sim2Carrier,
    },
  });

  // Check for any pending call request queued for this device (fast polling support)
  const pendingCall = await prisma.callingRequest.findFirst({
    where: {
      deviceId: params.deviceId,
      status: { in: [CallingRequestStatus.QUEUED, CallingRequestStatus.SENT] },
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    include: {
      lead: { select: { name: true } },
    },
  });

  return {
    success: true,
    timestamp: new Date().toISOString(),
    pendingCall: pendingCall
      ? {
          requestId: pendingCall.id,
          phone: pendingCall.studentPhone,
          studentName: pendingCall.lead?.name || "Student",
          preferredSim: pendingCall.preferredSim,
        }
      : null,
  };
}

/**
 * Fetch all calling devices with calculated live online/offline state
 */
export async function getCallingDevices(userId?: string) {
  const now = Date.now();
  const devices = await prisma.callingDevice.findMany({
    where: {
      isActive: true,
      pairingCode: null, // Don't show pending uncompleted pairing PIN placeholders
    },
    orderBy: { createdAt: "desc" },
    include: {
      assignedUser: { select: { id: true, name: true, email: true } },
    },
  });

  return devices.map((d) => {
    const isRecentlyActive =
      d.lastHeartbeat && now - d.lastHeartbeat.getTime() < HEARTBEAT_OFFLINE_THRESHOLD_MS;
    const computedOnline = Boolean(d.isActive && isRecentlyActive);

    return {
      ...d,
      isOnline: computedOnline,
      isAssignedToCurrentUser: userId ? d.assignedUserId === userId : false,
    };
  });
}

/**
 * Assign a mobile device to a counsellor
 */
export async function assignCallingDevice(deviceId: string, userId: string, assignedBy: string) {
  // Deactivate any previous assignment
  await prisma.callingDeviceAssignment.updateMany({
    where: { deviceId, isActive: true },
    data: { isActive: false, revokedAt: new Date() },
  });

  // Create new assignment
  await prisma.callingDeviceAssignment.create({
    data: {
      deviceId,
      userId,
      assignedBy,
      isActive: true,
    },
  });

  const updated = await prisma.callingDevice.update({
    where: { id: deviceId },
    data: { assignedUserId: userId },
    include: { assignedUser: { select: { id: true, name: true } } },
  });

  await prisma.callingActivityLog.create({
    data: {
      deviceId,
      actorId: assignedBy,
      eventType: "DEVICE_ASSIGNED",
      metadata: { assignedToUserId: userId },
    },
  });

  return updated;
}

/**
 * Unpair/revoke a device
 */
export async function unpairCallingDevice(deviceId: string) {
  try {
    await prisma.callingDeviceAssignment.deleteMany({ where: { deviceId } });
    await prisma.callingSession.deleteMany({ where: { deviceId } });
    await prisma.callingActivityLog.deleteMany({ where: { deviceId } });
    await prisma.callingRequest.deleteMany({ where: { deviceId } });
    await prisma.callingDevice.deleteMany({ where: { id: deviceId } });
  } catch {
    await prisma.callingDevice.updateMany({
      where: { id: deviceId },
      data: {
        isActive: false,
        isOnline: false,
        fcmToken: null,
        assignedUserId: null,
      },
    });
  }

  return { success: true };
}

/**
 * Create a cellular calling request and notify Android phone via FCM
 */
export async function createCallingRequest(params: {
  leadId?: string;
  studentId?: string;
  studentPhone: string;
  deviceId: string;
  requestedById: string;
  preferredSim?: CallingSimPreference;
}) {
  const cleanPhone = params.studentPhone.replace(/\D/g, "");
  if (cleanPhone.length < 10) {
    throw new Error("Invalid student phone number");
  }

  // 1. Verify device exists and is ready
  const device = await prisma.callingDevice.findUnique({
    where: { id: params.deviceId },
  });

  if (!device || !device.isActive) {
    throw new Error("Selected Android device is inactive or not found");
  }

  if (!device.fcmToken) {
    throw new Error("Selected device is missing FCM token. Please ensure Atomic Calling is running on the handset.");
  }

  // Check device heartbeats
  const isRecentlyActive =
    device.lastHeartbeat &&
    Date.now() - device.lastHeartbeat.getTime() < 5 * 60 * 1000;
  if (!isRecentlyActive && !device.isOnline) {
    throw new Error(`Device "${device.deviceName}" is offline. Please open Atomic Calling app on the device.`);
  }

  // 2. Clear any stale pending requests on this device so the user is never blocked
  await prisma.callingRequest.updateMany({
    where: {
      deviceId: device.id,
      status: { in: [CallingRequestStatus.QUEUED, CallingRequestStatus.SENT] },
    },
    data: {
      status: CallingRequestStatus.MISSED,
      failureReason: "Superseded by new call request",
    },
  });

  // 3. Create CallingRequest record
  const idempotencyKey = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min expiry

  const request = await prisma.callingRequest.create({
    data: {
      leadId: params.leadId,
      studentId: params.studentId,
      studentPhone: params.studentPhone,
      requestedById: params.requestedById,
      deviceId: params.deviceId,
      preferredSim: params.preferredSim || CallingSimPreference.DEFAULT,
      status: CallingRequestStatus.QUEUED,
      idempotencyKey,
      expiresAt,
    },
    include: {
      lead: { select: { name: true, preferredCourse: true } },
    },
  });

  // 4. Send High-Priority FCM Push Notification
  try {
    const studentLabel = request.lead?.name || "Student";
    await sendPushToTokens([device.fcmToken], {
      title: "Incoming CRM Call Request",
      body: `Calling ${studentLabel} (${request.studentPhone})`,
      data: {
        type: "CRM_CALL_REQUEST",
        requestId: request.id,
        phone: request.studentPhone,
        studentName: studentLabel,
        preferredSim: request.preferredSim,
        expiresAt: expiresAt.toISOString(),
      },
    });

    await prisma.callingRequest.update({
      where: { id: request.id },
      data: { status: CallingRequestStatus.SENT },
    });

    await prisma.callingActivityLog.create({
      data: {
        callingRequestId: request.id,
        deviceId: device.id,
        actorId: params.requestedById,
        eventType: "REQUEST_DISPATCHED_FCM",
        metadata: { preferredSim: request.preferredSim },
      },
    });
  } catch (err: any) {
    console.error("[FCM Calling Dispatch Error]", err);
    await prisma.callingRequest.update({
      where: { id: request.id },
      data: {
        status: CallingRequestStatus.FAILED,
        failureReason: `FCM Dispatch failed: ${err.message}`,
      },
    });
    throw new Error(`Failed to send push request to device: ${err.message}`);
  }

  return {
    requestId: request.id,
    status: CallingRequestStatus.SENT,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Handle call request status events received from Android app or CRM
 */
export async function updateCallingRequestEvent(params: {
  requestId: string;
  status: CallingRequestStatus;
  durationSeconds?: number;
  failureReason?: string;
  outcome?: string;
  remarks?: string;
}) {
  const request = await prisma.callingRequest.findUnique({
    where: { id: params.requestId },
    include: { lead: true, device: true },
  });

  if (!request) {
    throw new Error("Calling request not found");
  }

  const updated = await prisma.callingRequest.update({
    where: { id: params.requestId },
    data: {
      status: params.status,
      failureReason: params.failureReason || request.failureReason,
    },
  });

  // Create or update CallingSession if call progressed
  if (params.status === CallingRequestStatus.CALLING || params.status === CallingRequestStatus.COMPLETED) {
    const existingSession = await prisma.callingSession.findFirst({
      where: { callingRequestId: request.id },
    });

    if (!existingSession) {
      await prisma.callingSession.create({
        data: {
          callingRequestId: request.id,
          leadId: request.leadId,
          deviceId: request.deviceId,
          initiatedAt: new Date(),
          durationSeconds: params.durationSeconds,
          durationSource: params.durationSeconds ? "SYSTEM_DETECTED" : null,
          outcome: params.outcome || "CONNECTED",
          remarks: params.remarks,
        },
      });
    } else if (params.status === CallingRequestStatus.COMPLETED) {
      await prisma.callingSession.update({
        where: { id: existingSession.id },
        data: {
          completedAt: new Date(),
          durationSeconds: params.durationSeconds || existingSession.durationSeconds,
          outcome: params.outcome || existingSession.outcome,
          remarks: params.remarks || existingSession.remarks,
        },
      });
    }
  }

  // If completed, update lead lastContactedAt and log CRMCallRecord
  if (params.status === CallingRequestStatus.COMPLETED && request.leadId) {
    await prisma.cRMLead.update({
      where: { id: request.leadId },
      data: {
        lastContactedAt: new Date(),
        status: "CONTACTED",
      },
    });

    await prisma.cRMCallRecord.create({
      data: {
        leadId: request.leadId,
        counsellorId: request.requestedById,
        direction: "OUTBOUND",
        durationSeconds: params.durationSeconds || 0,
        outcome: (params.outcome as CRMCallOutcome) || CRMCallOutcome.CONNECTED,
        notes: `SIM cellular call placed via ${request.device.deviceName} (${request.preferredSim})`,
        provider: "SIM_CELLULAR",
        providerCallId: request.id,
      },
    });

    await prisma.cRMLeadActivity.create({
      data: {
        leadId: request.leadId,
        type: CRMActivityType.CALL_LOGGED,
        title: `SIM Call Completed (${params.outcome || "CONNECTED"})`,
        description: `Cellular call placed through physical SIM handset ${request.device.deviceName}. Duration: ${params.durationSeconds || 0}s`,
        performedById: request.requestedById,
      },
    });
  }

  await prisma.callingActivityLog.create({
    data: {
      callingRequestId: request.id,
      deviceId: request.deviceId,
      eventType: `STATUS_${params.status}`,
      metadata: {
        duration: params.durationSeconds,
        outcome: params.outcome,
        reason: params.failureReason,
      },
    },
  });

  return updated;
}

/**
 * Fetch calling history
 */
export async function getCallingHistory(limit = 50) {
  return prisma.callingSession.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      callingRequest: {
        include: {
          requestedBy: { select: { id: true, name: true, email: true } },
          lead: { select: { id: true, name: true, phone: true, targetExam: true } },
        },
      },
      device: { select: { id: true, deviceName: true, sim1Carrier: true, sim2Carrier: true } },
    },
  });
}

import { prisma } from "@/lib/db";
import { pusherServer } from "@/lib/realtime/pusher-server";
import { directConversationChannel, DIRECT_MESSAGE_EVENTS } from "@/lib/realtime/events";
import { sendUserRealtimeNotification } from "@/lib/notifications/realtime";

export interface ParticipantInfo {
  id: string; // User ID
  name: string;
  email: string;
  role: string;
  photoUrl: string | null;
  phone?: string | null;
  studentId?: string;
  teacherId?: string;
}

export interface ConversationSummary {
  id: string;
  type: string; // "TEACHER_STUDENT" | "STUDENT_ADMIN" | "TEACHER_ADMIN"
  otherParticipant: ParticipantInfo;
  lastMessage: {
    id: string;
    body: string;
    createdAt: string;
    senderUserId: string;
    senderRole: string;
    isUnread: boolean;
  } | null;
  unreadCount: number;
  updatedAt: string;
  student?: {
    id: string;
    name: string;
    photoUrl: string | null;
    email: string;
  } | null;
  teacher?: {
    id: string;
    name: string;
    photoUrl: string | null;
    department?: string | null;
  } | null;
}

/**
 * Resolves list of conversations for a user based on their role and permissions.
 */
export async function getConversationsForUser(
  userId: string,
  userRole: string,
  options?: {
    tab?: string; // "all" | "admin_desk" | "teacher_directs"
    search?: string;
  }
): Promise<ConversationSummary[]> {
  const isAdmin =
    userRole === "SUPER_ADMIN" ||
    userRole === "ADMIN" ||
    userRole === "FOUNDER" ||
    userRole === "SUB_ADMIN";

  const student = await prisma.student.findUnique({
    where: { userId },
    select: { id: true },
  });

  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    select: { id: true },
  });

  let whereClause: any = {};

  if (isAdmin) {
    // Admin system-level access
    if (options?.tab === "admin_desk") {
      whereClause = {
        type: { in: ["STUDENT_ADMIN", "TEACHER_ADMIN"] },
      };
    } else if (options?.tab === "teacher_directs") {
      whereClause = {
        type: "TEACHER_STUDENT",
      };
    } else {
      // All conversations across the platform
      whereClause = {};
    }
  } else if (teacher) {
    // Teacher: only conversations where this teacher is assigned OR admin directs with this teacher
    whereClause = {
      OR: [
        { teacherId: teacher.id },
        { type: "TEACHER_ADMIN", teacherId: teacher.id },
      ],
    };
  } else if (student) {
    // Student: only conversations where this student is assigned OR student admin support
    whereClause = {
      OR: [
        { studentId: student.id },
        { type: "STUDENT_ADMIN", studentId: student.id },
      ],
    };
  } else {
    // Other staff: only if assigned as admin or participant
    whereClause = {
      OR: [{ adminUserId: userId }],
    };
  }

  const rawConversations = await prisma.teacherDirectConversation.findMany({
    where: whereClause,
    include: {
      student: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              photoUrl: true,
            },
          },
        },
      },
      teacher: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              photoUrl: true,
            },
          },
        },
      },
      adminUser: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          photoUrl: true,
          role: { select: { name: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  // Calculate unread counts per conversation for this user
  const conversationIds = rawConversations.map((c) => c.id);
  const unreadMessages = await prisma.teacherDirectMessage.findMany({
    where: {
      conversationId: { in: conversationIds },
      readAt: null,
      senderUserId: { not: userId },
    },
    select: {
      conversationId: true,
    },
  });

  const unreadCountMap: Record<string, number> = {};
  for (const msg of unreadMessages) {
    unreadCountMap[msg.conversationId] = (unreadCountMap[msg.conversationId] || 0) + 1;
  }

  const results: ConversationSummary[] = [];

  for (const conv of rawConversations) {
    const lastMsg = conv.messages[0] || null;

    // Determine other participant relative to caller
    let otherParticipant: ParticipantInfo = {
      id: "admin",
      name: "Admin / Support Desk",
      email: "support@atomicpathshala.com",
      role: "ADMIN",
      photoUrl: null,
    };

    if (student && conv.studentId === student.id) {
      // Caller is student -> other participant is teacher or admin
      if (conv.type === "STUDENT_ADMIN") {
        otherParticipant = {
          id: conv.adminUser?.id || "admin",
          name: conv.adminUser?.name || "Admin / Support Desk",
          email: conv.adminUser?.email || "support@atomicpathshala.com",
          role: "ADMIN",
          photoUrl: conv.adminUser?.photoUrl || null,
        };
      } else if (conv.teacher?.user) {
        otherParticipant = {
          id: conv.teacher.user.id,
          name: conv.teacher.user.name,
          email: conv.teacher.user.email,
          phone: conv.teacher.user.phone,
          role: "TEACHER",
          photoUrl: conv.teacher.user.photoUrl,
          teacherId: conv.teacher.id,
        };
      }
    } else if (teacher && conv.teacherId === teacher.id) {
      // Caller is teacher -> other participant is student or admin
      if (conv.type === "TEACHER_ADMIN") {
        otherParticipant = {
          id: conv.adminUser?.id || "admin",
          name: conv.adminUser?.name || "Administration",
          email: conv.adminUser?.email || "admin@atomicpathshala.com",
          role: "ADMIN",
          photoUrl: conv.adminUser?.photoUrl || null,
        };
      } else if (conv.student?.user) {
        otherParticipant = {
          id: conv.student.user.id,
          name: conv.student.user.name,
          email: conv.student.user.email,
          phone: conv.student.user.phone,
          role: "STUDENT",
          photoUrl: conv.student.user.photoUrl,
          studentId: conv.student.id,
        };
      }
    } else if (isAdmin) {
      // Caller is Admin -> show the primary counterparty
      if (conv.student?.user) {
        otherParticipant = {
          id: conv.student.user.id,
          name: conv.student.user.name,
          email: conv.student.user.email,
          phone: conv.student.user.phone,
          role: "STUDENT",
          photoUrl: conv.student.user.photoUrl,
          studentId: conv.student.id,
        };
      } else if (conv.teacher?.user) {
        otherParticipant = {
          id: conv.teacher.user.id,
          name: conv.teacher.user.name,
          email: conv.teacher.user.email,
          phone: conv.teacher.user.phone,
          role: "TEACHER",
          photoUrl: conv.teacher.user.photoUrl,
          teacherId: conv.teacher.id,
        };
      }
    }

    // Filter by search query if provided
    if (options?.search) {
      const q = options.search.toLowerCase();
      const matchName = otherParticipant.name.toLowerCase().includes(q);
      const matchEmail = otherParticipant.email.toLowerCase().includes(q);
      if (!matchName && !matchEmail) continue;
    }

    results.push({
      id: conv.id,
      type: conv.type,
      otherParticipant,
      lastMessage: lastMsg
        ? {
            id: lastMsg.id,
            body: lastMsg.body,
            createdAt: lastMsg.createdAt.toISOString(),
            senderUserId: lastMsg.senderUserId,
            senderRole: lastMsg.senderRole,
            isUnread: lastMsg.readAt === null && lastMsg.senderUserId !== userId,
          }
        : null,
      unreadCount: unreadCountMap[conv.id] || 0,
      updatedAt: conv.updatedAt.toISOString(),
      student: conv.student
        ? {
            id: conv.student.id,
            name: conv.student.user.name,
            photoUrl: conv.student.user.photoUrl,
            email: conv.student.user.email,
          }
        : null,
      teacher: conv.teacher
        ? {
            id: conv.teacher.id,
            name: conv.teacher.user.name,
            photoUrl: conv.teacher.user.photoUrl,
            department: conv.teacher.department,
          }
        : null,
    });
  }

  return results;
}

/**
 * Returns full message thread for a conversation and marks incoming unread messages as read.
 */
export async function getConversationThread(
  conversationId: string,
  userId: string,
  userRole: string
) {
  const isAdmin =
    userRole === "SUPER_ADMIN" ||
    userRole === "ADMIN" ||
    userRole === "FOUNDER" ||
    userRole === "SUB_ADMIN";

  const conversation = await prisma.teacherDirectConversation.findUnique({
    where: { id: conversationId },
    include: {
      student: {
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true, photoUrl: true },
          },
        },
      },
      teacher: {
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true, photoUrl: true },
          },
        },
      },
      adminUser: {
        select: { id: true, name: true, email: true, phone: true, photoUrl: true },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 200,
      },
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // Access validation:
  const student = await prisma.student.findUnique({ where: { userId }, select: { id: true } });
  const teacher = await prisma.teacher.findUnique({ where: { userId }, select: { id: true } });

  const isStudentMember = student && conversation.studentId === student.id;
  const isTeacherMember = teacher && conversation.teacherId === teacher.id;
  const isAdminMember = isAdmin || (conversation.adminUserId && conversation.adminUserId === userId);

  if (!isStudentMember && !isTeacherMember && !isAdminMember) {
    throw new Error("You do not have access to this conversation.");
  }

  // Mark all unread incoming messages as read
  const unreadUpdated = await prisma.teacherDirectMessage.updateMany({
    where: {
      conversationId,
      readAt: null,
      senderUserId: { not: userId },
    },
    data: {
      readAt: new Date(),
    },
  });

  // Re-broadcast updated unread count to current user if any messages were marked read
  if (unreadUpdated.count > 0) {
    try {
      const remainingUnread = await prisma.teacherDirectMessage.count({
        where: {
          recipientUserId: userId,
          readAt: null,
        },
      });

      sendUserRealtimeNotification(userId, {
        id: `read_${Date.now()}`,
        title: "Messages Read",
        body: "",
        type: "GENERAL",
        createdAt: new Date().toISOString(),
        unreadCount: remainingUnread,
      }).catch(() => null);
    } catch {
      // Non-blocking
    }
  }

  // Build sender map for display names and avatars
  const senderUserIds = Array.from(new Set(conversation.messages.map((m) => m.senderUserId)));
  const users = await prisma.user.findMany({
    where: { id: { in: senderUserIds } },
    select: { id: true, name: true, photoUrl: true, role: { select: { name: true } } },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const messages = conversation.messages.map((m) => {
    const sender = userMap.get(m.senderUserId);
    return {
      id: m.id,
      conversationId: m.conversationId,
      senderUserId: m.senderUserId,
      senderName: sender?.name || (m.senderRole === "ADMIN" ? "Admin" : "User"),
      senderPhotoUrl: sender?.photoUrl || null,
      senderRole: m.senderRole,
      recipientUserId: m.recipientUserId,
      recipientRole: m.recipientRole,
      body: m.body,
      readAt: m.readAt ? m.readAt.toISOString() : null,
      createdAt: m.createdAt.toISOString(),
      isSelf: m.senderUserId === userId,
    };
  });

  return {
    conversation: {
      id: conversation.id,
      type: conversation.type,
      student: conversation.student,
      teacher: conversation.teacher,
      adminUser: conversation.adminUser,
      updatedAt: conversation.updatedAt.toISOString(),
    },
    messages,
  };
}

/**
 * Universal Message Dispatcher supporting all 5 routes:
 * 1. Student -> Teacher
 * 2. Student -> Admin
 * 3. Teacher -> Student
 * 4. Admin -> Teacher
 * 5. Admin -> Student
 */
export async function sendMessage({
  senderUserId,
  senderRole,
  recipientType,
  recipientId,
  message,
  conversationId,
}: {
  senderUserId: string;
  senderRole: string;
  recipientType: "TEACHER" | "STUDENT" | "ADMIN";
  recipientId?: string;
  message: string;
  conversationId?: string;
}) {
  const cleanBody = message.trim();
  if (!cleanBody) throw new Error("Message text cannot be empty");
  if (cleanBody.length > 3000) throw new Error("Message exceeds 3000 characters limit");

  const sender = await prisma.user.findUnique({
    where: { id: senderUserId },
    select: { id: true, name: true, email: true, photoUrl: true },
  });
  if (!sender) throw new Error("Sender user not found");

  const senderIsAdmin =
    senderRole === "ADMIN" ||
    senderRole === "SUPER_ADMIN" ||
    senderRole === "FOUNDER" ||
    senderRole === "SUB_ADMIN";

  let resolvedConvId = conversationId;
  let targetRecipientUserId: string | null = null;
  let finalRecipientRole = recipientType;
  let convType = "TEACHER_STUDENT";

  // If conversationId is provided, lookup conversation first
  if (resolvedConvId) {
    const existingConv = await prisma.teacherDirectConversation.findUnique({
      where: { id: resolvedConvId },
      include: {
        student: { include: { user: true } },
        teacher: { include: { user: true } },
        adminUser: true,
      },
    });

    if (!existingConv) throw new Error("Conversation not found");
    convType = existingConv.type;

    // Determine recipient based on who the sender is
    if (senderRole === "STUDENT") {
      if (existingConv.type === "STUDENT_ADMIN") {
        finalRecipientRole = "ADMIN";
        targetRecipientUserId = existingConv.adminUserId || null;
      } else {
        finalRecipientRole = "TEACHER";
        targetRecipientUserId = existingConv.teacher?.user?.id || null;
      }
    } else if (senderRole === "TEACHER") {
      if (existingConv.type === "TEACHER_ADMIN") {
        finalRecipientRole = "ADMIN";
        targetRecipientUserId = existingConv.adminUserId || null;
      } else {
        finalRecipientRole = "STUDENT";
        targetRecipientUserId = existingConv.student?.user?.id || null;
      }
    } else if (senderIsAdmin) {
      if (existingConv.type === "STUDENT_ADMIN") {
        finalRecipientRole = "STUDENT";
        targetRecipientUserId = existingConv.student?.user?.id || null;
      } else if (existingConv.type === "TEACHER_ADMIN") {
        finalRecipientRole = "TEACHER";
        targetRecipientUserId = existingConv.teacher?.user?.id || null;
      } else {
        // In TEACHER_STUDENT, admin can reply to either teacher or student
        if (
          recipientId &&
          (recipientId === existingConv.teacher?.user?.id || recipientId === existingConv.teacherId)
        ) {
          finalRecipientRole = "TEACHER";
          targetRecipientUserId = existingConv.teacher?.user?.id || null;
        } else {
          finalRecipientRole = "STUDENT";
          targetRecipientUserId = existingConv.student?.user?.id || null;
        }
      }
    }
  } else {
    // ConversationId was not provided -> route based on recipientType & senderRole
    if (senderRole === "STUDENT" && recipientType === "TEACHER") {
      // 1. Student -> Teacher
      if (!recipientId) throw new Error("Teacher recipient ID is required");
      const targetTeacher = await prisma.teacher.findFirst({
        where: { OR: [{ id: recipientId }, { userId: recipientId }] },
        include: { user: true },
      });
      if (!targetTeacher) throw new Error("Target teacher not found");

      const student = await prisma.student.findUnique({ where: { userId: senderUserId } });
      if (!student) throw new Error("Student profile not found for sender");

      let conv = await prisma.teacherDirectConversation.findFirst({
        where: { studentId: student.id, teacherId: targetTeacher.id, type: "TEACHER_STUDENT" },
      });
      if (!conv) {
        conv = await prisma.teacherDirectConversation.create({
          data: { studentId: student.id, teacherId: targetTeacher.id, type: "TEACHER_STUDENT" },
        });
      }

      resolvedConvId = conv.id;
      targetRecipientUserId = targetTeacher.user.id;
      finalRecipientRole = "TEACHER";
      convType = "TEACHER_STUDENT";
    } else if (senderRole === "STUDENT" && recipientType === "ADMIN") {
      // 2. Student -> Admin (Admin Desk)
      const student = await prisma.student.findUnique({ where: { userId: senderUserId } });
      if (!student) throw new Error("Student profile not found for sender");

      let conv = await prisma.teacherDirectConversation.findFirst({
        where: { studentId: student.id, type: "STUDENT_ADMIN" },
      });
      if (!conv) {
        conv = await prisma.teacherDirectConversation.create({
          data: { studentId: student.id, type: "STUDENT_ADMIN" },
        });
      }

      resolvedConvId = conv.id;
      targetRecipientUserId = null; // Will notify all Admins
      finalRecipientRole = "ADMIN";
      convType = "STUDENT_ADMIN";
    } else if (senderRole === "TEACHER" && recipientType === "STUDENT") {
      // 3. Teacher -> Student
      if (!recipientId) throw new Error("Student recipient ID is required");
      const targetStudent = await prisma.student.findFirst({
        where: { OR: [{ id: recipientId }, { userId: recipientId }] },
        include: { user: true },
      });
      if (!targetStudent) throw new Error("Target student not found");

      const teacher = await prisma.teacher.findUnique({ where: { userId: senderUserId } });
      if (!teacher) throw new Error("Teacher profile not found for sender");

      let conv = await prisma.teacherDirectConversation.findFirst({
        where: { studentId: targetStudent.id, teacherId: teacher.id, type: "TEACHER_STUDENT" },
      });
      if (!conv) {
        conv = await prisma.teacherDirectConversation.create({
          data: { studentId: targetStudent.id, teacherId: teacher.id, type: "TEACHER_STUDENT" },
        });
      }

      resolvedConvId = conv.id;
      targetRecipientUserId = targetStudent.user.id;
      finalRecipientRole = "STUDENT";
      convType = "TEACHER_STUDENT";
    } else if (senderIsAdmin && recipientType === "TEACHER") {
      // 4. Admin -> Teacher
      if (!recipientId) throw new Error("Teacher recipient ID is required");
      const targetTeacher = await prisma.teacher.findFirst({
        where: { OR: [{ id: recipientId }, { userId: recipientId }] },
        include: { user: true },
      });
      if (!targetTeacher) throw new Error("Target teacher not found");

      let conv = await prisma.teacherDirectConversation.findFirst({
        where: { teacherId: targetTeacher.id, type: "TEACHER_ADMIN" },
      });
      if (!conv) {
        conv = await prisma.teacherDirectConversation.create({
          data: { teacherId: targetTeacher.id, adminUserId: senderUserId, type: "TEACHER_ADMIN" },
        });
      }

      resolvedConvId = conv.id;
      targetRecipientUserId = targetTeacher.user.id;
      finalRecipientRole = "TEACHER";
      convType = "TEACHER_ADMIN";
    } else if (senderIsAdmin && recipientType === "STUDENT") {
      // 5. Admin -> Student
      if (!recipientId) throw new Error("Student recipient ID is required");
      const targetStudent = await prisma.student.findFirst({
        where: { OR: [{ id: recipientId }, { userId: recipientId }] },
        include: { user: true },
      });
      if (!targetStudent) throw new Error("Target student not found");

      let conv = await prisma.teacherDirectConversation.findFirst({
        where: { studentId: targetStudent.id, type: "STUDENT_ADMIN" },
      });
      if (!conv) {
        conv = await prisma.teacherDirectConversation.create({
          data: { studentId: targetStudent.id, adminUserId: senderUserId, type: "STUDENT_ADMIN" },
        });
      }

      resolvedConvId = conv.id;
      targetRecipientUserId = targetStudent.user.id;
      finalRecipientRole = "STUDENT";
      convType = "STUDENT_ADMIN";
    } else {
      throw new Error(`Unsupported routing: ${senderRole} to ${recipientType}`);
    }
  }

  if (!resolvedConvId) throw new Error("Failed to resolve conversation");

  // Save the message in database
  const createdMsg = await prisma.teacherDirectMessage.create({
    data: {
      conversationId: resolvedConvId,
      senderUserId,
      senderRole,
      recipientUserId: targetRecipientUserId,
      recipientRole: finalRecipientRole,
      body: cleanBody,
    },
  });

  // Update conversation updatedAt
  await prisma.teacherDirectConversation.update({
    where: { id: resolvedConvId },
    data: { updatedAt: new Date() },
  });

  // Realtime Broadcast via Pusher to conversation channel
  const messagePayload = {
    id: createdMsg.id,
    conversationId: resolvedConvId,
    senderUserId,
    senderName: sender.name,
    senderPhotoUrl: sender.photoUrl,
    senderRole,
    recipientUserId: targetRecipientUserId,
    recipientRole: finalRecipientRole,
    body: createdMsg.body,
    readAt: null,
    createdAt: createdMsg.createdAt.toISOString(),
  };

  try {
    await pusherServer.trigger(
      directConversationChannel(resolvedConvId),
      DIRECT_MESSAGE_EVENTS.NEW_MESSAGE,
      messagePayload
    );
  } catch (err) {
    console.warn("Pusher direct message broadcast error:", err);
  }

  // Create In-App Notification and Pusher user-channel event
  const previewText = cleanBody.length > 100 ? cleanBody.substring(0, 97) + "..." : cleanBody;
  const notifTitle =
    senderRole === "STUDENT"
      ? `New message from ${sender.name}`
      : senderRole === "TEACHER"
      ? `New message from ${sender.name}`
      : `New message from Administration`;

  const deepLink =
    finalRecipientRole === "STUDENT"
      ? `/messages?conversationId=${resolvedConvId}`
      : `/team/messages?conversationId=${resolvedConvId}`;

  // If notifying a specific recipient user
  if (targetRecipientUserId) {
    try {
      await prisma.notification.create({
        data: {
          userId: targetRecipientUserId,
          title: notifTitle,
          body: previewText,
          type: "GENERAL",
          category: "SYSTEM",
          channel: "IN_APP",
          actionUrl: deepLink,
          deepLink,
          metadata: {
            conversationId: resolvedConvId,
            senderUserId,
            senderRole,
          },
        },
      });

      const unreadCount = await prisma.notification.count({
        where: { userId: targetRecipientUserId, isRead: false },
      });

      await sendUserRealtimeNotification(targetRecipientUserId, {
        id: `msg_${createdMsg.id}`,
        title: notifTitle,
        body: previewText,
        type: "GENERAL",
        deepLink,
        createdAt: createdMsg.createdAt.toISOString(),
        unreadCount,
      });
    } catch (notifErr) {
      console.warn("Notification dispatch failed for recipient:", notifErr);
    }
  } else if (finalRecipientRole === "ADMIN") {
    // If message is for Admin Desk, notify all active Admins
    try {
      const adminUsers = await prisma.user.findMany({
        where: { role: { name: { in: ["SUPER_ADMIN", "ADMIN", "FOUNDER"] } } },
        select: { id: true },
      });

      for (const admin of adminUsers) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            title: notifTitle,
            body: previewText,
            type: "GENERAL",
            category: "SYSTEM",
            channel: "IN_APP",
            actionUrl: deepLink,
            deepLink,
            metadata: {
              conversationId: resolvedConvId,
              senderUserId,
              senderRole,
            },
          },
        }).catch(() => null);

        const unreadCount = await prisma.notification.count({
          where: { userId: admin.id, isRead: false },
        });

        sendUserRealtimeNotification(admin.id, {
          id: `msg_${createdMsg.id}`,
          title: notifTitle,
          body: previewText,
          type: "GENERAL",
          deepLink,
          createdAt: createdMsg.createdAt.toISOString(),
          unreadCount,
        }).catch(() => null);
      }
    } catch (adminNotifErr) {
      console.warn("Admin notifications dispatch failed:", adminNotifErr);
    }
  }

  return {
    success: true,
    message: messagePayload,
    conversationId: resolvedConvId,
  };
}

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
  class?: string | null;
  enrollmentNumber?: string | null;
  department?: string | null;
}

export interface ConversationSummary {
  id: string;
  type: string; // "TEACHER_STUDENT" | "STUDENT_ADMIN" | "TEACHER_ADMIN"
  title: string; // e.g. "Rahul (Student) ↔ Firoz Sir (Teacher)"
  subtitle: string; // e.g. "Direct Academic Discussion"
  categoryLabel: string; // "Teacher ↔ Student", "Student Helpdesk Query", "Staff Direct"
  otherParticipant: ParticipantInfo;
  primaryParticipant: ParticipantInfo;
  secondaryParticipant?: ParticipantInfo | null;
  lastMessage: {
    id: string;
    body: string;
    createdAt: string;
    senderUserId: string;
    senderName?: string;
    senderRole: string;
    isUnread: boolean;
  } | null;
  unreadCount: number;
  updatedAt: string;
  student?: {
    id: string;
    userId: string;
    name: string;
    photoUrl: string | null;
    email: string;
    phone?: string | null;
    class?: string | null;
    enrollmentNumber?: string | null;
  } | null;
  teacher?: {
    id: string;
    userId: string;
    name: string;
    photoUrl: string | null;
    email?: string | null;
    phone?: string | null;
    department?: string | null;
  } | null;
  adminUser?: {
    id: string;
    name: string;
    email: string;
    photoUrl: string | null;
    role?: string;
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
    if (options?.tab === "teacher_directs" || options?.tab === "teacher_student") {
      whereClause = {
        type: "TEACHER_STUDENT",
      };
    } else if (options?.tab === "admin_desk" || options?.tab === "helpdesk" || options?.tab === "student_admin") {
      whereClause = {
        type: "STUDENT_ADMIN",
      };
    } else if (options?.tab === "staff_direct" || options?.tab === "teacher_admin") {
      whereClause = {
        type: "TEACHER_ADMIN",
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
        select: {
          id: true,
          class: true,
          enrollmentNumber: true,
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
        select: {
          id: true,
          department: true,
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

  // Lookup sender names for all last messages
  const lastMsgSenderIds = Array.from(
    new Set(rawConversations.map((c) => c.messages[0]?.senderUserId).filter(Boolean) as string[])
  );
  const senderUsers = await prisma.user.findMany({
    where: { id: { in: lastMsgSenderIds } },
    select: { id: true, name: true, photoUrl: true },
  });
  const senderUserMap = new Map(senderUsers.map((u) => [u.id, u]));

  const results: ConversationSummary[] = [];

  for (const conv of rawConversations) {
    const lastMsg = conv.messages[0] || null;

    const studentInfo: ParticipantInfo | null = conv.student?.user
      ? {
          id: conv.student.user.id,
          name: conv.student.user.name,
          email: conv.student.user.email,
          phone: conv.student.user.phone,
          role: "STUDENT",
          photoUrl: conv.student.user.photoUrl,
          studentId: conv.student.id,
          class: conv.student.class,
          enrollmentNumber: conv.student.enrollmentNumber,
        }
      : null;

    const teacherInfo: ParticipantInfo | null = conv.teacher?.user
      ? {
          id: conv.teacher.user.id,
          name: conv.teacher.user.name,
          email: conv.teacher.user.email,
          phone: conv.teacher.user.phone,
          role: "TEACHER",
          photoUrl: conv.teacher.user.photoUrl,
          teacherId: conv.teacher.id,
          department: conv.teacher.department,
        }
      : null;

    const adminInfo: ParticipantInfo | null = conv.adminUser
      ? {
          id: conv.adminUser.id,
          name: conv.adminUser.name,
          email: conv.adminUser.email,
          phone: conv.adminUser.phone,
          role: conv.adminUser.role?.name || "ADMIN",
          photoUrl: conv.adminUser.photoUrl,
        }
      : null;

    let primaryParticipant: ParticipantInfo = studentInfo || teacherInfo || adminInfo || {
      id: "unknown",
      name: "User",
      email: "",
      role: "USER",
      photoUrl: null,
    };

    let secondaryParticipant: ParticipantInfo | null = null;
    let title = "";
    let subtitle = "";
    let categoryLabel = "Direct Message";

    if (conv.type === "TEACHER_STUDENT") {
      primaryParticipant = studentInfo || primaryParticipant;
      secondaryParticipant = teacherInfo;
      const sName = studentInfo?.name || "Student";
      const tName = teacherInfo?.name || "Teacher";
      title = `${sName} ↔ ${tName}`;
      subtitle = `Conversation with ${tName} (${teacherInfo?.department || "Teacher"})`;
      categoryLabel = "Teacher ↔ Student";
    } else if (conv.type === "STUDENT_ADMIN") {
      primaryParticipant = studentInfo || primaryParticipant;
      secondaryParticipant = adminInfo || {
        id: "admin",
        name: "Admin / Support Desk",
        email: "support@atomicpathshala.com",
        role: "ADMIN",
        photoUrl: null,
      };
      const sName = studentInfo?.name || "Student";
      title = `${sName}`;
      subtitle = `Helpdesk Query / Support Request`;
      categoryLabel = "Student Query";
    } else if (conv.type === "TEACHER_ADMIN") {
      primaryParticipant = teacherInfo || primaryParticipant;
      secondaryParticipant = adminInfo || {
        id: "admin",
        name: "Administration",
        email: "admin@atomicpathshala.com",
        role: "ADMIN",
        photoUrl: null,
      };
      const tName = teacherInfo?.name || "Teacher";
      title = `${tName}`;
      subtitle = `Faculty & Staff Communication`;
      categoryLabel = "Staff Direct";
    } else {
      title = primaryParticipant.name;
      subtitle = "Direct Conversation";
      categoryLabel = "Direct Message";
    }

    // Determine otherParticipant relative to caller
    let otherParticipant = primaryParticipant;
    if (student && conv.studentId === student.id) {
      otherParticipant = secondaryParticipant || adminInfo || primaryParticipant;
    } else if (teacher && conv.teacherId === teacher.id) {
      otherParticipant = primaryParticipant.role === "TEACHER" && secondaryParticipant ? secondaryParticipant : primaryParticipant;
    } else if (isAdmin) {
      otherParticipant = primaryParticipant;
    }

    // Filter by search query if provided
    if (options?.search) {
      const q = options.search.toLowerCase();
      const matchPrimary = primaryParticipant.name.toLowerCase().includes(q) || primaryParticipant.email.toLowerCase().includes(q);
      const matchSecondary = secondaryParticipant?.name.toLowerCase().includes(q) || secondaryParticipant?.email.toLowerCase().includes(q);
      const matchTitle = title.toLowerCase().includes(q);
      const matchSubtitle = subtitle.toLowerCase().includes(q);
      const matchBody = lastMsg?.body.toLowerCase().includes(q);
      if (!matchPrimary && !matchSecondary && !matchTitle && !matchSubtitle && !matchBody) {
        continue;
      }
    }

    results.push({
      id: conv.id,
      type: conv.type,
      title,
      subtitle,
      categoryLabel,
      otherParticipant,
      primaryParticipant,
      secondaryParticipant,
      lastMessage: lastMsg
        ? {
            id: lastMsg.id,
            body: lastMsg.body,
            createdAt: lastMsg.createdAt.toISOString(),
            senderUserId: lastMsg.senderUserId,
            senderName:
              senderUserMap.get(lastMsg.senderUserId)?.name ||
              (lastMsg.senderRole === "ADMIN" ? "Admin" : lastMsg.senderRole === "TEACHER" ? "Teacher" : "Student"),
            senderRole: lastMsg.senderRole,
            isUnread: lastMsg.readAt === null && lastMsg.senderUserId !== userId,
          }
        : null,
      unreadCount: unreadCountMap[conv.id] || 0,
      updatedAt: conv.updatedAt.toISOString(),
      student: conv.student
        ? {
            id: conv.student.id,
            userId: conv.student.user.id,
            name: conv.student.user.name,
            photoUrl: conv.student.user.photoUrl,
            email: conv.student.user.email,
            phone: conv.student.user.phone,
            class: conv.student.class,
            enrollmentNumber: conv.student.enrollmentNumber,
          }
        : null,
      teacher: conv.teacher
        ? {
            id: conv.teacher.id,
            userId: conv.teacher.user.id,
            name: conv.teacher.user.name,
            photoUrl: conv.teacher.user.photoUrl,
            email: conv.teacher.user.email,
            phone: conv.teacher.user.phone,
            department: conv.teacher.department,
          }
        : null,
      adminUser: conv.adminUser
        ? {
            id: conv.adminUser.id,
            name: conv.adminUser.name,
            email: conv.adminUser.email,
            photoUrl: conv.adminUser.photoUrl,
            role: conv.adminUser.role?.name || "ADMIN",
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
  userRole: string | boolean
) {
  const isAdmin =
    userRole === true ||
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
        select: { id: true, name: true, email: true, phone: true, photoUrl: true, role: { select: { name: true } } },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 300,
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

  // Build sender & recipient map for display names and avatars
  const allUserIds = Array.from(
    new Set([
      ...conversation.messages.map((m) => m.senderUserId),
      ...conversation.messages.map((m) => m.recipientUserId).filter(Boolean) as string[],
    ])
  );
  const users = await prisma.user.findMany({
    where: { id: { in: allUserIds } },
    select: { id: true, name: true, photoUrl: true, role: { select: { name: true } } },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const messages = conversation.messages.map((m) => {
    const sender = userMap.get(m.senderUserId);
    const recipient = m.recipientUserId ? userMap.get(m.recipientUserId) : null;
    return {
      id: m.id,
      conversationId: m.conversationId,
      senderUserId: m.senderUserId,
      senderName: sender?.name || (m.senderRole === "ADMIN" ? "Admin" : m.senderRole === "TEACHER" ? "Teacher" : "Student"),
      senderPhotoUrl: sender?.photoUrl || null,
      senderRole: m.senderRole,
      recipientUserId: m.recipientUserId,
      recipientName: recipient?.name || (m.recipientRole === "ADMIN" ? "Admin" : m.recipientRole === "TEACHER" ? "Teacher" : m.recipientRole === "STUDENT" ? "Student" : null),
      recipientPhotoUrl: recipient?.photoUrl || null,
      recipientRole: m.recipientRole,
      body: m.body,
      readAt: m.readAt ? m.readAt.toISOString() : null,
      isRead: m.readAt !== null,
      createdAt: m.createdAt.toISOString(),
      isSelf: m.senderUserId === userId,
    };
  });

  const studentName = conversation.student?.user.name || "Student";
  const teacherName = conversation.teacher?.user.name || "Teacher";
  let title = "Conversation";
  let subtitle = "";
  if (conversation.type === "TEACHER_STUDENT") {
    title = `${studentName} ↔ ${teacherName}`;
    subtitle = `Conversation between ${studentName} (Student) and ${teacherName} (Teacher)`;
  } else if (conversation.type === "STUDENT_ADMIN") {
    title = `${studentName}`;
    subtitle = `Helpdesk Query / Student Support`;
  } else if (conversation.type === "TEACHER_ADMIN") {
    title = `${teacherName}`;
    subtitle = `Faculty & Staff Communication`;
  }

  return {
    conversation: {
      id: conversation.id,
      type: conversation.type,
      title,
      subtitle,
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

  let targetRecipientName: string | null = null;
  let targetRecipientPhotoUrl: string | null = null;
  if (targetRecipientUserId) {
    const recUser = await prisma.user.findUnique({
      where: { id: targetRecipientUserId },
      select: { name: true, photoUrl: true },
    });
    targetRecipientName = recUser?.name || null;
    targetRecipientPhotoUrl = recUser?.photoUrl || null;
  }

  // Realtime Broadcast via Pusher to conversation channel
  const messagePayload = {
    id: createdMsg.id,
    conversationId: resolvedConvId,
    senderUserId,
    senderName: sender.name,
    senderPhotoUrl: sender.photoUrl,
    senderRole,
    recipientUserId: targetRecipientUserId,
    recipientName:
      targetRecipientName ||
      (finalRecipientRole === "ADMIN"
        ? "Admin"
        : finalRecipientRole === "TEACHER"
        ? "Teacher"
        : "Student"),
    recipientPhotoUrl: targetRecipientPhotoUrl,
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

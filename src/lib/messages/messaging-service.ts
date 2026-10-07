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
  isOnline?: boolean;
  lastSeen?: string | null;
}

export interface ReplyToSnippet {
  id: string;
  senderName: string;
  senderRole: string;
  body: string;
  mediaType?: string | null;
}

export interface MessageItem {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderName: string;
  senderPhotoUrl: string | null;
  senderRole: string;
  recipientUserId?: string | null;
  recipientRole?: string | null;
  body: string;
  mediaUrl?: string | null;
  mediaType?: string | null; // "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "VOICE"
  mediaName?: string | null;
  mediaSize?: number | null;
  replyToId?: string | null;
  replyToMessage?: ReplyToSnippet | null;
  isForwarded?: boolean;
  isEdited?: boolean;
  isDeleted?: boolean;
  deletedFor?: string[];
  reactions?: Record<string, string[]>; // { "❤️": [userId1, userId2] }
  starredBy?: string[];
  isStarred?: boolean;
  pinnedAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  isSelf: boolean;
  pending?: boolean;
  status?: "sending" | "sent" | "delivered" | "read";
}

export interface ConversationSummary {
  id: string;
  type: string; // "TEACHER_STUDENT" | "STUDENT_ADMIN" | "TEACHER_ADMIN" | "BATCH_GROUP" | "DOUBT_EXPERT" | "ANNOUNCEMENT"
  title?: string | null;
  description?: string | null;
  iconUrl?: string | null;
  batchId?: string | null;
  batchName?: string | null;
  isPinned: boolean;
  isArchived: boolean;
  isMuted: boolean;
  onlyAdminsCanPost: boolean;
  metadata?: any;
  otherParticipant: ParticipantInfo;
  participantsCount?: number;
  lastMessage: {
    id: string;
    body: string;
    mediaType?: string | null;
    mediaName?: string | null;
    createdAt: string;
    senderUserId: string;
    senderRole: string;
    isUnread: boolean;
    readAt: string | null;
    isDeleted?: boolean;
    isEdited?: boolean;
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
  adminUser?: {
    id: string;
    name: string;
    photoUrl: string | null;
    email: string;
  } | null;
}

/**
 * Resolves list of conversations for a user based on their role and permissions.
 */
export async function getConversationsForUser(
  userId: string,
  userRole: string,
  options?: {
    tab?: string; // "all" | "teachers" | "doubts" | "batches" | "admin_desk" | "unread" | "archived"
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
    select: {
      id: true,
      batchEnrollments: { select: { batchId: true } },
    },
  });

  const studentBatchIds = student?.batchEnrollments?.map((b) => b.batchId) || [];

  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    select: { id: true },
  });

  let whereClause: any = {};

  if (isAdmin) {
    // Admin system-level access
    if (options?.tab === "admin_desk") {
      whereClause = {
        type: { in: ["STUDENT_ADMIN", "TEACHER_ADMIN", "ANNOUNCEMENT"] },
      };
    } else if (options?.tab === "teachers") {
      whereClause = {
        type: "TEACHER_STUDENT",
      };
    } else if (options?.tab === "doubts") {
      whereClause = {
        type: "DOUBT_EXPERT",
      };
    } else if (options?.tab === "batches") {
      whereClause = {
        type: "BATCH_GROUP",
      };
    } else {
      whereClause = {};
    }
  } else if (teacher) {
    // Teacher: conversations where this teacher is assigned or teacher-admin or batch/doubt
    whereClause = {
      OR: [
        { teacherId: teacher.id },
        { type: "TEACHER_ADMIN", teacherId: teacher.id },
        { type: "DOUBT_EXPERT", teacherId: teacher.id },
        { type: "BATCH_GROUP" },
        { type: "ANNOUNCEMENT" },
      ],
    };

    if (options?.tab === "doubts") {
      whereClause = { type: "DOUBT_EXPERT", teacherId: teacher.id };
    } else if (options?.tab === "batches") {
      whereClause = { type: "BATCH_GROUP" };
    } else if (options?.tab === "admin_desk") {
      whereClause = { type: "TEACHER_ADMIN", teacherId: teacher.id };
    } else if (options?.tab === "teachers") {
      whereClause = { type: "TEACHER_STUDENT", teacherId: teacher.id };
    }
  } else if (student) {
    // Student: conversations where this student is assigned or student admin support or student's batch
    const studentOrClauses: any[] = [
      { studentId: student.id },
      { type: "STUDENT_ADMIN", studentId: student.id },
      { type: "DOUBT_EXPERT", studentId: student.id },
      { type: "ANNOUNCEMENT" },
    ];

    if (studentBatchIds.length > 0) {
      studentOrClauses.push({ type: "BATCH_GROUP", batchId: { in: studentBatchIds } });
    }

    whereClause = { OR: studentOrClauses };

    if (options?.tab === "doubts") {
      whereClause = { type: "DOUBT_EXPERT", studentId: student.id };
    } else if (options?.tab === "batches") {
      whereClause = {
        type: "BATCH_GROUP",
        ...(studentBatchIds.length > 0 ? { batchId: { in: studentBatchIds } } : {}),
      };
    } else if (options?.tab === "admin_desk") {
      whereClause = { type: "STUDENT_ADMIN", studentId: student.id };
    } else if (options?.tab === "teachers") {
      whereClause = { type: "TEACHER_STUDENT", studentId: student.id };
    }
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
    orderBy: [
      { isPinned: "desc" },
      { updatedAt: "desc" },
    ],
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

  // Load batch names if any batch conversations exist
  const batchIds = rawConversations.map((c) => c.batchId).filter(Boolean) as string[];
  const batchMap: Record<string, string> = {};
  if (batchIds.length > 0) {
    const batches = await prisma.batch.findMany({
      where: { id: { in: batchIds } },
      select: { id: true, name: true },
    });
    for (const b of batches) {
      batchMap[b.id] = b.name;
    }
  }

  const results: ConversationSummary[] = [];

  for (const conv of rawConversations) {
    const lastMsg = conv.messages[0] || null;

    // Determine other participant / chat display info
    let otherParticipant: ParticipantInfo = {
      id: "admin",
      name: conv.title || "Admin / Support Desk",
      email: "support@atomicpathshala.com",
      role: "ADMIN",
      photoUrl: conv.iconUrl || null,
    };

    if (conv.type === "BATCH_GROUP") {
      const batchName = (conv.batchId && batchMap[conv.batchId]) || conv.title || "Batch Cohort";
      otherParticipant = {
        id: conv.batchId || conv.id,
        name: conv.title || batchName,
        email: "batch@atomicpathshala.com",
        role: "BATCH",
        photoUrl: conv.iconUrl || null,
      };
    } else if (conv.type === "DOUBT_EXPERT") {
      if (student && conv.teacher?.user) {
        otherParticipant = {
          id: conv.teacher.user.id,
          name: conv.teacher.user.name,
          email: conv.teacher.user.email,
          phone: conv.teacher.user.phone,
          role: "DOUBT_EXPERT",
          photoUrl: conv.teacher.user.photoUrl,
          teacherId: conv.teacher.id,
        };
      } else if (teacher && conv.student?.user) {
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
    } else if (student && conv.studentId === student.id) {
      if (conv.type === "STUDENT_ADMIN") {
        otherParticipant = {
          id: conv.adminUser?.id || "admin",
          name: conv.title || conv.adminUser?.name || "Admin / Support Desk",
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
      if (conv.type === "TEACHER_ADMIN") {
        otherParticipant = {
          id: conv.adminUser?.id || "admin",
          name: conv.title || conv.adminUser?.name || "Administration",
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

    const unreadCount = unreadCountMap[conv.id] || 0;

    // Filter by tab: unread or archived
    if (options?.tab === "unread" && unreadCount === 0) continue;
    if (options?.tab === "archived" && !conv.isArchived) continue;
    if (options?.tab !== "archived" && conv.isArchived) continue;

    // Filter by search query if provided
    if (options?.search) {
      const q = options.search.toLowerCase();
      const matchName = otherParticipant.name.toLowerCase().includes(q);
      const matchEmail = otherParticipant.email.toLowerCase().includes(q);
      const matchTitle = (conv.title || "").toLowerCase().includes(q);
      const matchLastMsg = (lastMsg?.body || "").toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchTitle && !matchLastMsg) continue;
    }

    results.push({
      id: conv.id,
      type: conv.type,
      title: conv.title,
      description: conv.description,
      iconUrl: conv.iconUrl,
      batchId: conv.batchId,
      batchName: conv.batchId ? batchMap[conv.batchId] : null,
      isPinned: conv.isPinned,
      isArchived: conv.isArchived,
      isMuted: conv.isMuted,
      onlyAdminsCanPost: conv.onlyAdminsCanPost,
      metadata: conv.metadata,
      otherParticipant,
      lastMessage: lastMsg
        ? {
            id: lastMsg.id,
            body: lastMsg.isDeleted ? "This message was deleted" : lastMsg.body,
            mediaType: lastMsg.mediaType,
            mediaName: lastMsg.mediaName,
            createdAt: lastMsg.createdAt.toISOString(),
            senderUserId: lastMsg.senderUserId,
            senderRole: lastMsg.senderRole,
            isUnread: lastMsg.readAt === null && lastMsg.senderUserId !== userId,
            readAt: lastMsg.readAt ? lastMsg.readAt.toISOString() : null,
            isDeleted: lastMsg.isDeleted,
            isEdited: lastMsg.isEdited,
          }
        : null,
      unreadCount,
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
      adminUser: conv.adminUser
        ? {
            id: conv.adminUser.id,
            name: conv.adminUser.name,
            photoUrl: conv.adminUser.photoUrl,
            email: conv.adminUser.email,
          }
        : null,
    });
  }

  return results;
}

/**
 * Returns full message thread with cursor-based pagination and marks incoming unread messages as read.
 */
export async function getConversationThread(
  conversationId: string,
  userId: string,
  userRole: string,
  options?: {
    cursor?: string; // message ID to fetch older messages before
    limit?: number;
  }
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
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // Access validation:
  const student = await prisma.student.findUnique({
    where: { userId },
    select: {
      id: true,
      batchEnrollments: { select: { batchId: true } },
    },
  });
  const studentBatchIds = student?.batchEnrollments?.map((b) => b.batchId) || [];
  const teacher = await prisma.teacher.findUnique({ where: { userId }, select: { id: true } });

  const isStudentMember =
    (student && conversation.studentId === student.id) ||
    (conversation.type === "BATCH_GROUP" && student && (!conversation.batchId || studentBatchIds.includes(conversation.batchId))) ||
    (conversation.type === "ANNOUNCEMENT");
  const isTeacherMember =
    (teacher && conversation.teacherId === teacher.id) ||
    (conversation.type === "BATCH_GROUP" && !!teacher) ||
    (conversation.type === "ANNOUNCEMENT" && !!teacher);
  const isAdminMember = isAdmin || (conversation.adminUserId && conversation.adminUserId === userId);

  if (!isStudentMember && !isTeacherMember && !isAdminMember) {
    throw new Error("You do not have access to this conversation.");
  }

  const limit = options?.limit || 50;
  const messageWhere: any = {
    conversationId,
  };

  if (options?.cursor) {
    const cursorMsg = await prisma.teacherDirectMessage.findUnique({
      where: { id: options.cursor },
      select: { createdAt: true },
    });
    if (cursorMsg) {
      messageWhere.createdAt = { lt: cursorMsg.createdAt };
    }
  }

  // Fetch messages in descending order then reverse for chronological rendering
  const rawMessages = await prisma.teacherDirectMessage.findMany({
    where: messageWhere,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const orderedMessages = rawMessages.reverse();

  // Mark all unread incoming messages as read & delivered
  const now = new Date();
  const unreadUpdated = await prisma.teacherDirectMessage.updateMany({
    where: {
      conversationId,
      readAt: null,
      senderUserId: { not: userId },
    },
    data: {
      readAt: now,
      deliveredAt: now,
    },
  });

  // Re-broadcast updated read receipts via Pusher
  if (unreadUpdated.count > 0) {
    try {
      await pusherServer.trigger(
        directConversationChannel(conversationId),
        DIRECT_MESSAGE_EVENTS.MESSAGES_READ,
        {
          conversationId,
          readByUserId: userId,
          readAt: now.toISOString(),
        }
      );
    } catch {
      // Non-blocking
    }
  }

  // Build sender map for display names and avatars
  const senderUserIds = Array.from(new Set(orderedMessages.map((m) => m.senderUserId)));
  const users = await prisma.user.findMany({
    where: { id: { in: senderUserIds } },
    select: { id: true, name: true, photoUrl: true, role: { select: { name: true } } },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  // Build replyTo map for quoted message preview
  const replyIds = orderedMessages.map((m) => m.replyToId).filter(Boolean) as string[];
  let replyMap = new Map<string, ReplyToSnippet>();
  if (replyIds.length > 0) {
    const replyMsgs = await prisma.teacherDirectMessage.findMany({
      where: { id: { in: replyIds } },
      select: { id: true, senderUserId: true, senderRole: true, body: true, mediaType: true, isDeleted: true },
    });
    const replySenderIds = Array.from(new Set(replyMsgs.map((r) => r.senderUserId)));
    const replyUsers = await prisma.user.findMany({
      where: { id: { in: replySenderIds } },
      select: { id: true, name: true },
    });
    const replyUserMap = new Map(replyUsers.map((u) => [u.id, u.name]));
    for (const rm of replyMsgs) {
      replyMap.set(rm.id, {
        id: rm.id,
        senderName: replyUserMap.get(rm.senderUserId) || "User",
        senderRole: rm.senderRole,
        body: rm.isDeleted ? "This message was deleted" : rm.body,
        mediaType: rm.mediaType,
      });
    }
  }

  const messages: MessageItem[] = orderedMessages
    .filter((m) => {
      // Exclude messages deleted specifically for this user
      const delFor = Array.isArray(m.deletedFor) ? (m.deletedFor as string[]) : [];
      return !delFor.includes(userId);
    })
    .map((m) => {
      const sender = userMap.get(m.senderUserId);
      const isSelf = m.senderUserId === userId;
      const reactions = (m.reactions && typeof m.reactions === "object" ? m.reactions : {}) as Record<string, string[]>;
      const starredBy = Array.isArray(m.starredBy) ? (m.starredBy as string[]) : [];
      const isStarred = starredBy.includes(userId);

      let status: "sending" | "sent" | "delivered" | "read" = "sent";
      if (m.readAt) status = "read";
      else if (m.deliveredAt) status = "delivered";

      return {
        id: m.id,
        conversationId: m.conversationId,
        senderUserId: m.senderUserId,
        senderName: sender?.name || (m.senderRole === "ADMIN" ? "Admin" : "User"),
        senderPhotoUrl: sender?.photoUrl || null,
        senderRole: m.senderRole,
        recipientUserId: m.recipientUserId,
        recipientRole: m.recipientRole,
        body: m.isDeleted ? "This message was deleted" : m.body,
        mediaUrl: m.isDeleted ? null : m.mediaUrl,
        mediaType: m.isDeleted ? null : m.mediaType,
        mediaName: m.isDeleted ? null : m.mediaName,
        mediaSize: m.isDeleted ? null : m.mediaSize,
        replyToId: m.replyToId,
        replyToMessage: m.replyToId ? replyMap.get(m.replyToId) || null : null,
        isForwarded: m.isForwarded,
        isEdited: m.isEdited,
        isDeleted: m.isDeleted,
        deletedFor: Array.isArray(m.deletedFor) ? (m.deletedFor as string[]) : [],
        reactions,
        starredBy,
        isStarred,
        pinnedAt: m.pinnedAt ? m.pinnedAt.toISOString() : null,
        deliveredAt: m.deliveredAt ? m.deliveredAt.toISOString() : null,
        readAt: m.readAt ? m.readAt.toISOString() : null,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt ? m.updatedAt.toISOString() : undefined,
        isSelf,
        status,
      };
    });

  // Resolve batch name if batch conversation
  let batchName = null;
  if (conversation.batchId) {
    const b = await prisma.batch.findUnique({ where: { id: conversation.batchId }, select: { name: true } });
    batchName = b?.name || null;
  }

  return {
    conversation: {
      id: conversation.id,
      type: conversation.type,
      title: conversation.title,
      description: conversation.description,
      iconUrl: conversation.iconUrl,
      batchId: conversation.batchId,
      batchName,
      isPinned: conversation.isPinned,
      isArchived: conversation.isArchived,
      isMuted: conversation.isMuted,
      onlyAdminsCanPost: conversation.onlyAdminsCanPost,
      metadata: conversation.metadata,
      student: conversation.student,
      teacher: conversation.teacher,
      adminUser: conversation.adminUser,
      updatedAt: conversation.updatedAt.toISOString(),
    },
    messages,
    hasMore: orderedMessages.length >= limit,
  };
}

/**
 * Universal Message Dispatcher with rich WhatsApp capabilities:
 * - Media attachments (image, video, audio/voice, pdf/documents)
 * - Reply quotes
 * - Forwarded flag
 * - Optimistic client ID deduplication
 * - Group permissions check (onlyAdminsCanPost)
 */
export async function sendMessage({
  senderUserId,
  senderRole,
  recipientType,
  recipientId,
  message,
  conversationId,
  clientMessageId,
  replyToId,
  mediaUrl,
  mediaType,
  mediaName,
  mediaSize,
  isForwarded = false,
}: {
  senderUserId: string;
  senderRole: string;
  recipientType?: "TEACHER" | "STUDENT" | "ADMIN" | "BATCH_GROUP" | "DOUBT_EXPERT";
  recipientId?: string;
  message?: string;
  conversationId?: string;
  clientMessageId?: string;
  replyToId?: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  mediaName?: string | null;
  mediaSize?: number | null;
  isForwarded?: boolean;
}) {
  const cleanBody = (message || "").trim();
  if (!cleanBody && !mediaUrl) {
    throw new Error("Message text or media is required");
  }
  if (cleanBody.length > 5000) {
    throw new Error("Message exceeds 5000 characters limit");
  }

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
  let finalRecipientRole = recipientType || "ADMIN";

  // If conversationId is provided, lookup conversation
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

    // Group permission check: only admins can post
    if (existingConv.onlyAdminsCanPost && !senderIsAdmin && senderRole !== "TEACHER") {
      throw new Error("Only administrators and teachers are allowed to send messages in this group.");
    }

    // Deduplication check: if clientMessageId already exists
    if (clientMessageId) {
      const dupe = await prisma.teacherDirectMessage.findUnique({
        where: { id: clientMessageId },
      });
      if (dupe) {
        return {
          success: true,
          message: dupe,
          conversationId: resolvedConvId,
        };
      }
    }

    if (existingConv.type === "BATCH_GROUP" || existingConv.type === "ANNOUNCEMENT") {
      finalRecipientRole = "BATCH_GROUP";
      targetRecipientUserId = null;
    } else if (senderRole === "STUDENT") {
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
    // Route by recipientType & senderRole
    if (senderRole === "STUDENT" && recipientType === "TEACHER") {
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
    } else if (senderRole === "STUDENT" && recipientType === "ADMIN") {
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
      targetRecipientUserId = null;
      finalRecipientRole = "ADMIN";
    } else if (senderRole === "TEACHER" && recipientType === "STUDENT") {
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
    } else if (senderIsAdmin && recipientType === "TEACHER") {
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
    } else if (senderIsAdmin && recipientType === "STUDENT") {
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
    } else {
      throw new Error(`Unsupported routing: ${senderRole} to ${recipientType}`);
    }
  }

  if (!resolvedConvId) throw new Error("Failed to resolve conversation");

  // Save the message in database
  const createdMsg = await prisma.teacherDirectMessage.create({
    data: {
      ...(clientMessageId ? { id: clientMessageId } : {}),
      conversationId: resolvedConvId,
      senderUserId,
      senderRole,
      recipientUserId: targetRecipientUserId,
      recipientRole: finalRecipientRole,
      body: cleanBody,
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null,
      mediaName: mediaName || null,
      mediaSize: mediaSize || null,
      replyToId: replyToId || null,
      isForwarded: !!isForwarded,
    },
  });

  // Update conversation updatedAt
  await prisma.teacherDirectConversation.update({
    where: { id: resolvedConvId },
    data: { updatedAt: new Date() },
  });

  // Fetch quoted reply message details if present
  let replyToSnippet: ReplyToSnippet | null = null;
  if (replyToId) {
    const qMsg = await prisma.teacherDirectMessage.findUnique({
      where: { id: replyToId },
      include: { conversation: false },
    });
    if (qMsg) {
      const qUser = await prisma.user.findUnique({ where: { id: qMsg.senderUserId }, select: { name: true } });
      replyToSnippet = {
        id: qMsg.id,
        senderName: qUser?.name || "User",
        senderRole: qMsg.senderRole,
        body: qMsg.isDeleted ? "This message was deleted" : qMsg.body,
        mediaType: qMsg.mediaType,
      };
    }
  }

  // Realtime Broadcast via Pusher to conversation channel
  const messagePayload: MessageItem = {
    id: createdMsg.id,
    conversationId: resolvedConvId,
    senderUserId,
    senderName: sender.name,
    senderPhotoUrl: sender.photoUrl,
    senderRole,
    recipientUserId: targetRecipientUserId,
    recipientRole: finalRecipientRole,
    body: createdMsg.body,
    mediaUrl: createdMsg.mediaUrl,
    mediaType: createdMsg.mediaType,
    mediaName: createdMsg.mediaName,
    mediaSize: createdMsg.mediaSize,
    replyToId: createdMsg.replyToId,
    replyToMessage: replyToSnippet,
    isForwarded: createdMsg.isForwarded,
    isEdited: false,
    isDeleted: false,
    deletedFor: [],
    reactions: {},
    starredBy: [],
    isStarred: false,
    pinnedAt: null,
    deliveredAt: null,
    readAt: null,
    createdAt: createdMsg.createdAt.toISOString(),
    isSelf: false,
    status: "sent",
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
  const previewText =
    mediaType
      ? `${mediaType === "IMAGE" ? "📷 Photo" : mediaType === "VIDEO" ? "🎥 Video" : mediaType === "VOICE" ? "🎤 Voice message" : "📄 Document"}${cleanBody ? `: ${cleanBody}` : ""}`
      : cleanBody.length > 100
      ? cleanBody.substring(0, 97) + "..."
      : cleanBody;

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

/**
 * Edit a message
 */
export async function editMessage(messageId: string, userId: string, newBody: string) {
  const cleanBody = newBody.trim();
  if (!cleanBody) throw new Error("Message text cannot be empty");

  const msg = await prisma.teacherDirectMessage.findUnique({
    where: { id: messageId },
  });

  if (!msg) throw new Error("Message not found");
  if (msg.senderUserId !== userId) throw new Error("You can only edit your own messages");
  if (msg.isDeleted) throw new Error("Cannot edit a deleted message");

  const updated = await prisma.teacherDirectMessage.update({
    where: { id: messageId },
    data: {
      body: cleanBody,
      isEdited: true,
      updatedAt: new Date(),
    },
  });

  // Realtime Broadcast
  try {
    await pusherServer.trigger(
      directConversationChannel(msg.conversationId),
      DIRECT_MESSAGE_EVENTS.MESSAGE_UPDATED,
      {
        id: updated.id,
        conversationId: updated.conversationId,
        body: updated.body,
        isEdited: true,
        updatedAt: updated.updatedAt.toISOString(),
      }
    );
  } catch (err) {
    console.warn("Pusher broadcast error on edit message:", err);
  }

  return updated;
}

/**
 * Delete message (Delete for me vs Delete for everyone)
 */
export async function deleteMessage(messageId: string, userId: string, userRole: string, mode: "ME" | "EVERYONE") {
  const isAdmin =
    userRole === "SUPER_ADMIN" ||
    userRole === "ADMIN" ||
    userRole === "FOUNDER" ||
    userRole === "SUB_ADMIN";

  const msg = await prisma.teacherDirectMessage.findUnique({
    where: { id: messageId },
  });

  if (!msg) throw new Error("Message not found");

  if (mode === "ME") {
    const existing = Array.isArray(msg.deletedFor) ? (msg.deletedFor as string[]) : [];
    if (!existing.includes(userId)) {
      await prisma.teacherDirectMessage.update({
        where: { id: messageId },
        data: {
          deletedFor: [...existing, userId],
        },
      });
    }
    return { success: true, mode: "ME", id: messageId };
  } else {
    // Delete for everyone
    if (msg.senderUserId !== userId && !isAdmin) {
      throw new Error("You can only delete for everyone on your own messages");
    }

    const updated = await prisma.teacherDirectMessage.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        body: "This message was deleted",
        mediaUrl: null,
        mediaType: null,
        mediaName: null,
      },
    });

    try {
      await pusherServer.trigger(
        directConversationChannel(msg.conversationId),
        DIRECT_MESSAGE_EVENTS.MESSAGE_UPDATED,
        {
          id: updated.id,
          conversationId: updated.conversationId,
          isDeleted: true,
          body: "This message was deleted",
          mediaUrl: null,
          mediaType: null,
        }
      );
    } catch (err) {
      console.warn("Pusher broadcast error on delete message:", err);
    }

    return { success: true, mode: "EVERYONE", id: messageId };
  }
}

/**
 * Toggle emoji reaction on message
 */
export async function reactToMessage(messageId: string, userId: string, emoji: string) {
  const msg = await prisma.teacherDirectMessage.findUnique({
    where: { id: messageId },
  });

  if (!msg) throw new Error("Message not found");

  const reactions = (msg.reactions && typeof msg.reactions === "object" ? { ...msg.reactions } : {}) as Record<string, string[]>;
  const currentList = Array.isArray(reactions[emoji]) ? [...reactions[emoji]] : [];

  if (currentList.includes(userId)) {
    // Remove reaction
    reactions[emoji] = currentList.filter((u) => u !== userId);
    if (reactions[emoji].length === 0) {
      delete reactions[emoji];
    }
  } else {
    // Add reaction
    reactions[emoji] = [...currentList, userId];
  }

  const updated = await prisma.teacherDirectMessage.update({
    where: { id: messageId },
    data: { reactions },
  });

  try {
    await pusherServer.trigger(
      directConversationChannel(msg.conversationId),
      DIRECT_MESSAGE_EVENTS.MESSAGE_UPDATED,
      {
        id: updated.id,
        conversationId: updated.conversationId,
        reactions: updated.reactions,
      }
    );
  } catch (err) {
    console.warn("Pusher broadcast error on react:", err);
  }

  return updated.reactions;
}

/**
 * Toggle star / bookmark on message
 */
export async function toggleStarMessage(messageId: string, userId: string) {
  const msg = await prisma.teacherDirectMessage.findUnique({
    where: { id: messageId },
  });

  if (!msg) throw new Error("Message not found");

  const starred = Array.isArray(msg.starredBy) ? [...(msg.starredBy as string[])] : [];
  let isStarred = false;

  let newStarred: string[];
  if (starred.includes(userId)) {
    newStarred = starred.filter((u) => u !== userId);
    isStarred = false;
  } else {
    newStarred = [...starred, userId];
    isStarred = true;
  }

  await prisma.teacherDirectMessage.update({
    where: { id: messageId },
    data: { starredBy: newStarred },
  });

  return { isStarred, messageId };
}

/**
 * Toggle pin message in conversation
 */
export async function togglePinMessage(messageId: string) {
  const msg = await prisma.teacherDirectMessage.findUnique({
    where: { id: messageId },
  });

  if (!msg) throw new Error("Message not found");

  const newPinnedAt = msg.pinnedAt ? null : new Date();

  const updated = await prisma.teacherDirectMessage.update({
    where: { id: messageId },
    data: { pinnedAt: newPinnedAt },
  });

  try {
    await pusherServer.trigger(
      directConversationChannel(msg.conversationId),
      DIRECT_MESSAGE_EVENTS.MESSAGE_UPDATED,
      {
        id: updated.id,
        conversationId: updated.conversationId,
        pinnedAt: updated.pinnedAt ? updated.pinnedAt.toISOString() : null,
      }
    );
  } catch (err) {
    console.warn("Pusher broadcast error on pin:", err);
  }

  return { isPinned: !!newPinnedAt, pinnedAt: newPinnedAt?.toISOString() || null };
}

/**
 * Update conversation settings (pin, archive, mute, group permissions)
 */
export async function updateConversationSettings(
  conversationId: string,
  userId: string,
  updates: {
    isPinned?: boolean;
    isArchived?: boolean;
    isMuted?: boolean;
    title?: string;
    description?: string;
    iconUrl?: string;
    onlyAdminsCanPost?: boolean;
  }
) {
  const conv = await prisma.teacherDirectConversation.findUnique({
    where: { id: conversationId },
  });

  if (!conv) throw new Error("Conversation not found");

  const updated = await prisma.teacherDirectConversation.update({
    where: { id: conversationId },
    data: {
      ...(typeof updates.isPinned === "boolean" ? { isPinned: updates.isPinned } : {}),
      ...(typeof updates.isArchived === "boolean" ? { isArchived: updates.isArchived } : {}),
      ...(typeof updates.isMuted === "boolean" ? { isMuted: updates.isMuted } : {}),
      ...(typeof updates.title === "string" ? { title: updates.title } : {}),
      ...(typeof updates.description === "string" ? { description: updates.description } : {}),
      ...(typeof updates.iconUrl === "string" ? { iconUrl: updates.iconUrl } : {}),
      ...(typeof updates.onlyAdminsCanPost === "boolean" ? { onlyAdminsCanPost: updates.onlyAdminsCanPost } : {}),
    },
  });

  try {
    await pusherServer.trigger(
      directConversationChannel(conversationId),
      DIRECT_MESSAGE_EVENTS.CONVERSATION_UPDATED,
      updated
    );
  } catch (err) {
    console.warn("Pusher broadcast error on conv update:", err);
  }

  return updated;
}

/**
 * Broadcast live typing indicator
 */
export async function broadcastTyping(conversationId: string, userId: string, userName: string, isTyping: boolean) {
  try {
    await pusherServer.trigger(
      directConversationChannel(conversationId),
      DIRECT_MESSAGE_EVENTS.TYPING_STATUS,
      {
        conversationId,
        userId,
        userName,
        isTyping,
      }
    );
  } catch (err) {
    console.warn("Typing broadcast error:", err);
  }
}

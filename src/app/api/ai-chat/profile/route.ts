import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/ai-chat/auth";
import { profileUpdateSchema } from "@/lib/ai-chat/validation";
import { publicUser, userToStudentProfile } from "@/lib/ai-chat/profile-utils";
import { getPrisma } from "@/lib/ai-chat/prisma";
import { logAiChatEvent } from "@/lib/ai-chat/audit";
import { Prisma } from "@prisma/client";

function unauthorized() {
  return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
}

function toNullableJson(value: unknown) {
  return value === null
    ? Prisma.JsonNull
    : (value as Prisma.InputJsonValue);
}

export const runtime = "nodejs";

export async function GET() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return unauthorized();

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    include: {
      aiChatProfile: true,
      aiChatPreferences: true,
      aiMemory: true,
      aiChatAccess: {
        include: {
          batch: { select: { id: true, title: true } },
          course: { select: { id: true, title: true } },
          subscription: {
            select: {
              id: true,
              plan: true,
              accessType: true,
              accessStatus: true,
              grantedAt: true,
              endsAt: true,
              reason: true,
              grantedBy: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
  });
  if (!user) return unauthorized();

  return NextResponse.json({
    user: publicUser(user),
    studentProfile: userToStudentProfile(user, user.aiChatProfile),
    profile: user.aiChatProfile,
    preferences: user.aiChatPreferences,
    aiMemory: user.aiMemory,
    access: user.aiChatAccess,
  });
}

export async function PATCH(request: Request) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return unauthorized();

  const parsed = profileUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid profile details." },
      { status: 400 }
    );
  }

  const { name, theme, language, emailNotifications, pushNotifications, privacyMode, ...profile } = parsed.data;
  const prisma = getPrisma();
  const profileUpdate: Prisma.UserProfileUpdateWithoutUserInput = {
    ...(profile.phone !== undefined ? { phone: profile.phone } : {}),
    ...(profile.className !== undefined ? { className: profile.className } : {}),
    ...(profile.target !== undefined ? { target: profile.target } : {}),
    ...(profile.board !== undefined ? { board: profile.board } : {}),
    ...(profile.preferredLanguage !== undefined
      ? { preferredLanguage: profile.preferredLanguage }
      : {}),
    ...(profile.preferredTeachers !== undefined
      ? { preferredTeachers: profile.preferredTeachers }
      : {}),
    ...(profile.strongChapters !== undefined ? { strongChapters: profile.strongChapters } : {}),
    ...(profile.weakChapters !== undefined ? { weakChapters: profile.weakChapters } : {}),
    ...(profile.favoriteSubject !== undefined ? { favoriteSubject: profile.favoriteSubject } : {}),
    ...(profile.learningPreferences !== undefined
      ? { learningPreferences: toNullableJson(profile.learningPreferences) }
      : {}),
    ...(profile.recentActivity !== undefined
      ? { recentActivity: toNullableJson(profile.recentActivity) }
      : {}),
  };

  const user = await prisma.user.update({
    where: { id: sessionUser.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      aiChatProfile: {
        upsert: {
          create: {
            className: profile.className ?? null,
            target: profile.target ?? "NEET",
            board: profile.board ?? null,
            preferredLanguage: profile.preferredLanguage ?? "hinglish",
            preferredTeachers: profile.preferredTeachers ?? [],
            strongChapters: profile.strongChapters ?? [],
            weakChapters: profile.weakChapters ?? [],
            favoriteSubject: profile.favoriteSubject ?? null,
            phone: profile.phone ?? null,
            ...(profile.learningPreferences !== undefined
              ? { learningPreferences: toNullableJson(profile.learningPreferences) }
              : {}),
            ...(profile.recentActivity !== undefined
              ? { recentActivity: toNullableJson(profile.recentActivity) }
              : {}),
          },
          update: profileUpdate,
        },
      },
      aiChatPreferences: {
        upsert: {
          create: {
            theme: theme ?? "system",
            language: language ?? profile.preferredLanguage ?? "hinglish",
            emailNotifications: emailNotifications ?? true,
            pushNotifications: pushNotifications ?? true,
            privacyMode: privacyMode ?? false,
          },
          update: {
            ...(theme !== undefined ? { theme } : {}),
            ...(language !== undefined ? { language } : {}),
            ...(emailNotifications !== undefined ? { emailNotifications } : {}),
            ...(pushNotifications !== undefined ? { pushNotifications } : {}),
            ...(privacyMode !== undefined ? { privacyMode } : {}),
          },
        },
      },
    },
    include: { aiChatProfile: true, aiChatPreferences: true, aiChatAccess: true },
  });
  await logAiChatEvent({
    actorUserId: user.id,
    targetUserId: user.id,
    event: "USER_UPDATED",
    entityType: "User",
  });

  return NextResponse.json({
    user: publicUser(user),
    studentProfile: userToStudentProfile(user, user.aiChatProfile),
    profile: user.aiChatProfile,
    preferences: user.aiChatPreferences,
    access: user.aiChatAccess,
  });
}

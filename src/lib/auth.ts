import type { NextAuthOptions } from "next-auth";
import { AUTH_SECRET } from "@/lib/auth-secret";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import {
  checkDeviceLoginAllowed,
  createDeviceSession,
  extractRequestMeta,
  isDeviceSessionValid,
  type RequestDeviceMeta,
  type DeviceCategory,
} from "@/lib/security/device-session";
import { normaliseLoginIdentifier } from "@/lib/validation/auth";

/**
 * Enterprise Authentication & Session Policy:
 * - 30-day persistent rolling sessions (maxAge: 30 days, updateAge: 24h).
 * - Multi-device category policy: default allows 1 Laptop, 1 Tablet, 1 Mobile.
 * - Persistent device recognition: client passes deviceId + deviceCategory + deviceName.
 * - Device replacement workflow for users switching phones/computers.
 * - Admin per-user controls for allowed device categories and max limits.
 */
export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days persistent session
    updateAge: 24 * 60 * 60,   // update token once every 24 hours
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60, // 30 days cookie
      },
    },
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        deviceId: { label: "Device ID", type: "text" },
        deviceName: { label: "Device Name", type: "text" },
        deviceCategory: { label: "Device Category", type: "text" },
        replaceSessionId: { label: "Replace Session ID", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const id = normaliseLoginIdentifier(credentials.email);
        const user = await prisma.user.findFirst({
          where: id.kind === "phone" ? { phone: id.value } : { email: id.value },
          include: { role: true },
        });

        if (!user) return null;

        const CAN_SIGN_IN: string[] = [
          "ACTIVE",
          "PENDING_VERIFICATION",
          "APPROVAL_PENDING",
          "INVITED",
          "NO_ROLE",
        ];
        if (!CAN_SIGN_IN.includes(user.status)) return null;

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        const headerMeta = extractRequestMeta(req?.headers as Record<string, string | string[] | undefined>);
        const meta: RequestDeviceMeta = {
          ...headerMeta,
          deviceId: (credentials as any).deviceId || headerMeta.deviceId || undefined,
          deviceName: (credentials as any).deviceName || headerMeta.deviceName || undefined,
          deviceCategory: ((credentials as any).deviceCategory as DeviceCategory) || headerMeta.deviceCategory || undefined,
        };

        const replaceSessionId = (credentials as any).replaceSessionId || undefined;

        // Verify device allowance and category limits
        if (!replaceSessionId) {
          const check = await checkDeviceLoginAllowed(user.id, meta);
          if (!check.allowed) {
            const payload = JSON.stringify({
              code: check.reason,
              message: check.message,
              conflictingSession: check.conflictingSession,
            });
            throw new Error(`DEVICE_RESTRICTION:${payload}`);
          }
        }

        const deviceSessionId = await createDeviceSession(user.id, meta, replaceSessionId);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role?.name ?? null,
          image: user.photoUrl ?? undefined,
          deviceSessionId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string | null }).role ?? null;
        token.deviceSessionId = (user as { deviceSessionId?: string | null }).deviceSessionId ?? null;
        token.deviceValid = true;
        token.deviceCheckedAt = Date.now();
        return token;
      }

      // Check device validity every 60s
      const DEVICE_CHECK_TTL_MS = 60_000;
      const checkedAt = typeof token.deviceCheckedAt === "number" ? token.deviceCheckedAt : 0;
      if (Date.now() - checkedAt > DEVICE_CHECK_TTL_MS) {
        try {
          token.deviceValid = await isDeviceSessionValid(token.deviceSessionId ?? undefined);
        } catch {
          // Never lock everyone out on a transient DB error
          token.deviceValid = true;
        }
        token.deviceCheckedAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      const valid = token.deviceValid !== false;
      if (session.user && valid && token.id) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string | null) ?? null;
      } else if (session.user && !valid) {
        delete (session as any).user;
      }
      return session;
    },
  },
  secret: AUTH_SECRET,
};

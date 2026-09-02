import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createDeviceSession, extractRequestMeta, isDeviceSessionValid } from "@/lib/security/device-session";

/**
 * Auth policy (locked):
 * - Password authentication only.
 * - Never use SMS OTP.
 * - Email verification is a future addition, not required at Phase 1.
 *
 * Security Center (device sessions / single-session enforcement) added on
 * top without changing this shape: authorize() now also opens a
 * DeviceSession row (see @/lib/security/device-session.ts) and its id
 * rides along in the JWT; the session callback re-validates it on every
 * call. A user with SecurityConfig.policy=SINGLE_SESSION who logs in on a
 * second device gets their first device's DeviceSession row revoked —
 * their next request there fails the revalidation check below, and
 * session.user.id/.role are simply left unset, which every existing route
 * already treats as "not signed in" via `if (!session?.user?.id)`. No
 * route/page guard needed to change for this to work.
 */
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          include: { role: true },
        });

        if (!user) return null;
        if (user.status !== "ACTIVE") return null;

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        const meta = extractRequestMeta(req?.headers as Record<string, string | string[] | undefined>);
        const deviceSessionId = await createDeviceSession(user.id, meta);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role.name,
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
        token.role = (user as { role: string }).role;
        token.deviceSessionId = (user as { deviceSessionId?: string | null }).deviceSessionId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      try {
        const valid = await isDeviceSessionValid(token.deviceSessionId ?? undefined);
        if (session.user && valid && token.id) {
          session.user.id = token.id as string;
          session.user.role = (token.role as string) || "STUDENT";
        } else if (session.user && !valid) {
          delete (session as any).user;
        }
      } catch {
        if (session.user && token.id) {
          session.user.id = token.id as string;
          session.user.role = (token.role as string) || "STUDENT";
        }
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

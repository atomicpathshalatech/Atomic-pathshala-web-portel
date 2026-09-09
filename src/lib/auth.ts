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
        // Statuses that may still sign in (they'll land on a "no access yet"
        // screen in the team portal); everything else is a hard block.
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

        const meta = extractRequestMeta(req?.headers as Record<string, string | string[] | undefined>);
        const deviceSessionId = await createDeviceSession(user.id, meta);

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
    /**
     * The DeviceSession revalidation used to run in the `session` callback,
     * i.e. one cross-region Postgres round trip on EVERY `getServerSession()`
     * — every page load and every one of the ~300 API routes. That check now
     * lives here and is throttled: the result + a timestamp are cached on the
     * (encrypted, httpOnly) JWT and the DB is only re-queried once the cache
     * is older than DEVICE_CHECK_TTL_MS. Effect on the single-session policy:
     * a revoked device is detected on its next request after the TTL window
     * instead of literally the next request — a <=60s delay, not a hole.
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string | null }).role ?? null;
        token.deviceSessionId = (user as { deviceSessionId?: string | null }).deviceSessionId ?? null;
        token.deviceValid = true;
        token.deviceCheckedAt = Date.now();
        return token;
      }

      const DEVICE_CHECK_TTL_MS = 60_000;
      const checkedAt = typeof token.deviceCheckedAt === "number" ? token.deviceCheckedAt : 0;
      if (Date.now() - checkedAt > DEVICE_CHECK_TTL_MS) {
        try {
          token.deviceValid = await isDeviceSessionValid(token.deviceSessionId ?? undefined);
        } catch {
          // never lock everyone out on a transient DB error
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
        // No implicit "STUDENT" fallback — a user with no role must read as
        // roleless so the team portal shows the "no role assigned" screen
        // instead of silently treating them as a student.
        session.user.role = (token.role as string | null) ?? null;
      } else if (session.user && !valid) {
        delete (session as any).user;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "atomic-pathshala-production-enterprise-secret-key-2026-secure-jwt",
};

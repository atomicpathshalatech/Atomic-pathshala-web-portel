import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: string;
    // Set only by the Credentials authorize() callback on sign-in — the
    // DeviceSession row created for this login, carried through the jwt
    // callback into the token so every later `session` callback call can
    // re-check whether it's still valid (see isDeviceSessionValid()).
    deviceSessionId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    deviceSessionId?: string | null;
  }
}

/**
 * A logged-in HTTP session against a running Atomic Pathshala server (for
 * integration tests): signs in through NextAuth's credentials provider and
 * keeps the cookies. Use only with local test accounts on a local server.
 */
export class HttpSession {
  private cookies = new Map<string, string>();
  constructor(public base: string) {}

  private store(res: Response) {
    const raw = (res.headers as any).getSetCookie?.() ?? [];
    for (const c of raw as string[]) {
      const [pair] = c.split(";");
      const i = pair!.indexOf("=");
      this.cookies.set(pair!.slice(0, i), pair!.slice(i + 1));
    }
  }
  private header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  async fetch(path: string, init: RequestInit = {}) {
    const res = await fetch(this.base + path, { ...init, redirect: "manual", headers: { ...(init.headers || {}), cookie: this.header() } });
    this.store(res);
    return res;
  }

  async json(path: string, init: RequestInit = {}) {
    const res = await this.fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init.headers || {}) } });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  }

  async login(email: string, password: string) {
    const attempt = async (replaceSessionId?: string) => {
      const csrf = await this.json("/api/auth/csrf");
      const form = new URLSearchParams({ csrfToken: csrf.body.csrfToken, email, password, deviceId: "integration-test-device", deviceName: "Integration tests", deviceCategory: "DESKTOP", json: "true", callbackUrl: this.base, ...(replaceSessionId ? { replaceSessionId } : {}) });
      const res = await this.fetch("/api/auth/callback/credentials", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() });
      return { status: res.status, body: (await res.json().catch(() => null)) as { url?: string } | null };
    };
    let r = await attempt();
    // The account's device limit is reached: replace the other session, as the login screen offers.
    const err = decodeURIComponent(r.body?.url?.split("error=")[1] ?? "");
    if (err.startsWith("DEVICE_RESTRICTION:")) {
      const info = JSON.parse(err.slice("DEVICE_RESTRICTION:".length));
      if (info?.conflictingSession?.id) r = await attempt(info.conflictingSession.id);
    }
    const session = await this.json("/api/auth/session");
    if (!session.body?.user?.id) throw new Error(`login failed (HTTP ${r.status}): ${decodeURIComponent(r.body?.url ?? "").slice(0, 200)}`);
    return session.body.user as { id: string; email: string; role?: string };
  }
}

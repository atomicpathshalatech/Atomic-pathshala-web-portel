// LOCAL DEV ONLY: runs `next dev` for this checkout against the disposable
// local test database, with a deliberately minimal environment — local DB,
// a random auth secret, and only the Pusher keys (so realtime works). No
// YouTube/LiveKit/R2/email/SMS/payment keys are loaded, so nothing created
// while clicking around can reach a production service.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.PORT || "3217";
const pusherSource = process.env.PUSHER_ENV_FILE || join(root, ".env.local");

const env = {
  PATH: process.env.PATH,
  SystemRoot: process.env.SystemRoot,
  TEMP: process.env.TEMP,
  TMP: process.env.TMP,
  USERPROFILE: process.env.USERPROFILE,
  APPDATA: process.env.APPDATA,
  LOCALAPPDATA: process.env.LOCALAPPDATA,
  DATABASE_URL: "postgresql://postgres@localhost:5433/atomic_test",
  DIRECT_URL: "postgresql://postgres@localhost:5433/atomic_test",
  NEXTAUTH_SECRET: randomBytes(32).toString("base64url"),
  NEXTAUTH_URL: `http://localhost:${port}`,
  NEXT_PUBLIC_APP_URL: `http://localhost:${port}`,
  APP_URL: `http://localhost:${port}`,
  APP_BASE_URL: `http://localhost:${port}`,
  YOUTUBE_OAUTH_PRODUCTION_URL: `http://localhost:${port}`,
  NEXT_TELEMETRY_DISABLED: "1",
};

if (existsSync(pusherSource)) {
  for (const line of readFileSync(pusherSource, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*((NEXT_PUBLIC_)?PUSHER_[A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) env[m[1]] = m[3];
  }
}

const child = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "dev", "-p", port], {
  cwd: root,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});
child.on("exit", (code) => process.exit(code ?? 0));

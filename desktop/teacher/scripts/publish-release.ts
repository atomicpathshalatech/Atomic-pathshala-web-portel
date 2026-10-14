// Publishes a built Teacher app release to file storage (desktop/ folder):
// the installer and its blockmap first, latest.yml last — installed apps read
// latest.yml to find a new version, so it must never point at a file that is
// not there yet.
//   node --env-file=<.env> node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json desktop/teacher/scripts/publish-release.ts <dist folder>
import "../../../scripts/qc/_stub";
import fs from "node:fs";
import path from "node:path";
import { uploadBufferToR2 } from "../../../src/lib/storage/r2-client";

(async () => {
  const dir = path.resolve(process.argv[2] || "desktop/teacher/dist");
  const manifest = fs.readFileSync(path.join(dir, "latest.yml"), "utf8");
  const exe = manifest.match(/^path:\s*(.+)$/m)?.[1]?.trim();
  if (!exe || !fs.existsSync(path.join(dir, exe))) throw new Error(`installer named in latest.yml not found: ${exe}`);
  const files: [string, string][] = [
    [exe, "application/vnd.microsoft.portable-executable"],
    [`${exe}.blockmap`, "application/octet-stream"],
    ["latest.yml", "text/yaml"],
  ];
  for (const [name, type] of files) {
    const buffer = fs.readFileSync(path.join(dir, name));
    await uploadBufferToR2({ key: `desktop/${name}`, buffer, contentType: type });
    console.log("uploaded", `desktop/${name}`, buffer.length, "bytes");
  }
  process.exit(0);
})().catch((e) => {
  console.error(String(e?.message ?? e).slice(0, 500));
  process.exit(1);
});

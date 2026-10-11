// Lets scripts import server modules ("server-only" is a Next.js build-time marker).
import Module from "node:module";
import path from "node:path";

const M = Module as unknown as { _resolveFilename: (req: string, ...rest: unknown[]) => string };
const original = M._resolveFilename;
M._resolveFilename = function (this: unknown, req: string, ...rest: unknown[]) {
  if (req === "server-only") return path.join(__dirname, "..", "fixtures", "empty-module.cjs");
  return original.call(this, req, ...rest);
};

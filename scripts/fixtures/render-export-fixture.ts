/**
 * Writes the PDF booklet HTML for the real-question fixture to a file (used by
 * desktop/teacher/scripts/test-test-pdf.mjs). Usage: tsx render-export-fixture.ts <out.html> [repeat] [with-solution|without-solution]
 */
import Module from "node:module";
import { writeFileSync } from "node:fs";

const M = Module as unknown as { _resolveFilename: (req: string, ...rest: unknown[]) => string };
const resolve = M._resolveFilename;
M._resolveFilename = function (req: string, ...rest: unknown[]) {
  if (req === "server-only") return require.resolve("./empty-module.cjs");
  return resolve.call(this, req, ...rest);
};

async function main() {
  const [out, repeat = "4", type = "with-solution"] = process.argv.slice(2);
  const { buildExportFixture } = await import("./build-export-fixture");
  const { generateTestPaperHtml } = await import("../../src/lib/pdf/test-export-engine");
  const html = generateTestPaperHtml(buildExportFixture({ repeat: Number(repeat) }), {
    withSolution: type === "with-solution",
    brandName: "ATOMIC PATHSHALA",
    watermarkText: "ATOMIC PATHSHALA",
    testPattern: "NEET",
  });
  writeFileSync(out!, html);
  console.log(`wrote ${out} (${html.length} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

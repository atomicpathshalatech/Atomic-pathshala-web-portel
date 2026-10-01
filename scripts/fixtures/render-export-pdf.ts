/**
 * Renders the real-question fixture booklet to a PDF file with the same
 * renderer as /api/tests/[id]/pdf. Usage: tsx render-export-pdf.ts <out.pdf> [repeat] [questions|solutions]
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
  const [out, repeat = "4", type = "questions"] = process.argv.slice(2);
  const { buildExportFixture } = await import("./build-export-fixture");
  const { generateTestPaperHtml } = await import("../../src/lib/pdf/test-export-engine");
  const { renderBookletPdf } = await import("../../src/lib/pdf/html-to-pdf");
  const html = generateTestPaperHtml(buildExportFixture({ repeat: Number(repeat) }), {
    withSolution: type === "solutions",
    brandName: "ATOMIC PATHSHALA",
    watermarkText: "ATOMIC PATHSHALA",
    testPattern: "NEET",
  });
  const t = Date.now();
  const pdf = await renderBookletPdf(html);
  writeFileSync(out!, pdf);
  console.log(`wrote ${out} (${(pdf.length / 1024).toFixed(0)} KB) in ${((Date.now() - t) / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

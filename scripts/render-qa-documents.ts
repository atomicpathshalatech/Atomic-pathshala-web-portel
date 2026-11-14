import fs from "fs";
import path from "path";
import { withRenderedPdf } from "../src/lib/pdf/page-renderer";

const DOCS = [
  { name: "01_Joining_Confirmation", file: "01_Joining_Confirmation.pdf" },
  { name: "02_Experience_Certificate", file: "02_Experience_Certificate.pdf" },
  { name: "03_Relieving_Letter", file: "03_Relieving_Letter.pdf" },
  { name: "04_Contract_Letter_Page1", file: "04_Contract_Letter.pdf", page: 1 },
  { name: "04_Contract_Letter_Page2", file: "04_Contract_Letter.pdf", page: 2 },
  { name: "04_Contract_Letter_Page3", file: "04_Contract_Letter.pdf", page: 3 },
];

async function main() {
  const outDir = path.join(process.cwd(), "qa-test-documents", "images");
  const artifactDir = "C:\\Users\\firoz\\.gemini\\antigravity\\brain\\5e8f1dd0-dbe2-4d6f-af8d-88833b444d15";

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const item of DOCS) {
    const pdfPath = path.join(process.cwd(), "qa-test-documents", item.file);
    const pdfBuf = fs.readFileSync(pdfPath);
    const pageNum = item.page || 1;

    await withRenderedPdf(pdfBuf, async (doc) => {
      const b64 = await doc.jpeg(pageNum, 1600);
      const imgBuf = Buffer.from(b64, "base64");
      const outPath = path.join(outDir, `${item.name}.jpg`);
      fs.writeFileSync(outPath, imgBuf);

      // Also copy to artifact dir
      const artPath = path.join(artifactDir, `${item.name}.jpg`);
      fs.writeFileSync(artPath, imgBuf);

      console.log(`Rendered ${item.name} -> ${outPath} (${imgBuf.length} bytes)`);
    });
  }

  console.log("ALL PAGES RENDERED SUCCESSFULLY!");
}

main().catch(console.error);

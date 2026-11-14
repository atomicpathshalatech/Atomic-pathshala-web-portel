import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import { buildExperienceCertificatePdf } from "../src/lib/documents/experience-certificate-template";
import { withRenderedPdf } from "../src/lib/pdf/page-renderer";

async function main() {
  console.log("Generating test Experience Certificate PDF for Ilmas Ameer (AP10001)...");

  const verificationUrl = "https://ap.atomicpathshala.in/verify/AP10001";
  const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 512,
    color: {
      dark: "#0a1f5c",
      light: "#ffffff",
    },
  });

  const pdfBuffer = await buildExperienceCertificatePdf({
    certificateNumber: "AP-EXP-2026-0001",
    issueDateStr: "14 November 2026",
    employeeName: "Ilmas Ameer",
    employeeId: "AP10001",
    designation: "Senior Chemistry Faculty",
    department: "Chemistry",
    startDateStr: "19 September 2026",
    endDateStr: "14 November 2026",
    conductRemarks: "During their engagement, they demonstrated outstanding subject mastery, pedagogical discipline, and student mentorship.",
    qrCodeDataUrl,
    verificationUrl,
  });

  const outPdfPath = path.join(process.cwd(), "test_experience_certificate_ap10001.pdf");
  fs.writeFileSync(outPdfPath, pdfBuffer);
  console.log(`Saved PDF to ${outPdfPath} (${pdfBuffer.length} bytes)`);

  // Render to image
  const artifactDir = "C:/Users/firoz/.gemini/antigravity/brain/5e8f1dd0-dbe2-4d6f-af8d-88833b444d15";
  const outJpgPath = path.join(artifactDir, "experience_certificate_ap10001_preview.jpg");

  await withRenderedPdf(pdfBuffer, async (doc) => {
    await doc.render(1);
    const b64 = await doc.jpeg(1, 1600);
    const imgBuf = Buffer.from(b64, "base64");
    fs.writeFileSync(outJpgPath, imgBuf);
    console.log(`Rendered preview to ${outJpgPath} (${imgBuf.length} bytes)`);
  });

  console.log("Done!");
}

main().catch(console.error);

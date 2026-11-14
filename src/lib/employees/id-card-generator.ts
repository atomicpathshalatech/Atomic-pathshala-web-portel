/**
 * ATOMIC PATHSHALA EDUCATION
 * Employee ID Card Generator Engine (CR80 Standard / High-Resolution Print PDF)
 * 
 * Design Standards:
 * - Dimensions: Standard CR80 Card (85.6mm x 53.98mm -> 242.6pt x 153pt) or High-Res Print Sheet (A4)
 * - Color Palette: Deep Navy Blue (#0a1f5c), Crisp White, Gold / Cyan Accents (#0284c7)
 * - Brand: ATOMIC PATHSHALA EDUCATION (Brand: Atomic Pathshala)
 * - Signatory: Firoz Ali, Founder and Director
 */

import "server-only";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { Employee } from "@prisma/client";
import { getAppBaseDomain } from "./employee-service";

export async function generateEmployeeIdCardPdf(employee: Employee): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();

  // Standard CR80 dimensions in points (72 points per inch)
  // Width: 85.6mm = 242.6pt, Height: 53.98mm = 153.0pt (Landscape)
  // Or Vertical Portrait: 153.0pt x 242.6pt
  // We'll create a vertical double-sided card (Page 1 = Front, Page 2 = Back)
  const cardWidth = 170;
  const cardHeight = 270;

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  // ==========================================
  // SIDE 1: FRONT OF ID CARD
  // ==========================================
  const front = pdfDoc.addPage([cardWidth, cardHeight]);

  // Card Background
  front.drawRectangle({
    x: 0,
    y: 0,
    width: cardWidth,
    height: cardHeight,
    color: rgb(1, 1, 1),
  });

  // Top Navy Curved Header Banner
  front.drawRectangle({
    x: 0,
    y: cardHeight - 55,
    width: cardWidth,
    height: 55,
    color: rgb(0.04, 0.12, 0.32), // Deep Navy
  });

  // Gold / Cyan Accent Stripe
  front.drawRectangle({
    x: 0,
    y: cardHeight - 58,
    width: cardWidth,
    height: 3,
    color: rgb(0.08, 0.52, 0.88),
  });

  // Header Typography
  front.drawText("ATOMIC PATHSHALA", {
    x: 15,
    y: cardHeight - 26,
    size: 11,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  });

  front.drawText("LEARN • EXPLORE • EXCEL", {
    x: 15,
    y: cardHeight - 38,
    size: 6.5,
    font: helvetica,
    color: rgb(0.7, 0.82, 0.98),
  });

  front.drawText("EMPLOYEE IDENTITY CARD", {
    x: 15,
    y: cardHeight - 49,
    size: 5.5,
    font: helveticaBold,
    color: rgb(0.9, 0.95, 1),
  });

  // Photo Frame Box
  const photoSize = 75;
  const photoX = (cardWidth - photoSize) / 2;
  const photoY = cardHeight - 145;

  front.drawRectangle({
    x: photoX - 2,
    y: photoY - 2,
    width: photoSize + 4,
    height: photoSize + 4,
    color: rgb(0.95, 0.96, 0.98),
    borderColor: rgb(0.08, 0.52, 0.88),
    borderWidth: 1.5,
  });

  // If photoUrl exists, try embedding photo, else draw placeholder avatar
  let photoDrawn = false;
  if (employee.photoUrl && employee.photoUrl.startsWith("http")) {
    try {
      const imgRes = await fetch(employee.photoUrl);
      if (imgRes.ok) {
        const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
        const isPng = employee.photoUrl.endsWith(".png");
        const embeddedImg = isPng ? await pdfDoc.embedPng(imgBuffer) : await pdfDoc.embedJpg(imgBuffer);
        front.drawImage(embeddedImg, {
          x: photoX,
          y: photoY,
          width: photoSize,
          height: photoSize,
        });
        photoDrawn = true;
      }
    } catch {
      photoDrawn = false;
    }
  }

  if (!photoDrawn) {
    // Elegant Avatar Placeholder
    front.drawRectangle({
      x: photoX,
      y: photoY,
      width: photoSize,
      height: photoSize,
      color: rgb(0.92, 0.94, 0.98),
    });
    front.drawText(employee.name.charAt(0).toUpperCase(), {
      x: photoX + 26,
      y: photoY + 24,
      size: 32,
      font: timesBold,
      color: rgb(0.08, 0.25, 0.55),
    });
  }

  // Employee Name
  const nameWidth = helveticaBold.widthOfTextAtSize(employee.name, 10.5);
  front.drawText(employee.name, {
    x: Math.max(10, (cardWidth - nameWidth) / 2),
    y: photoY - 14,
    size: 10.5,
    font: helveticaBold,
    color: rgb(0.04, 0.12, 0.32),
  });

  // Designation
  const desigWidth = helvetica.widthOfTextAtSize(employee.designation, 7.5);
  front.drawText(employee.designation, {
    x: Math.max(10, (cardWidth - desigWidth) / 2),
    y: photoY - 26,
    size: 7.5,
    font: helvetica,
    color: rgb(0.2, 0.25, 0.35),
  });

  // Department
  const deptText = `Department of ${employee.department}`;
  const deptWidth = helvetica.widthOfTextAtSize(deptText, 7);
  front.drawText(deptText, {
    x: Math.max(10, (cardWidth - deptWidth) / 2),
    y: photoY - 37,
    size: 7,
    font: helvetica,
    color: rgb(0.08, 0.45, 0.8),
  });

  // Employee ID Badge Pill
  const empPillWidth = 120;
  const empPillX = (cardWidth - empPillWidth) / 2;
  const empPillY = photoY - 58;

  front.drawRectangle({
    x: empPillX,
    y: empPillY,
    width: empPillWidth,
    height: 16,
    color: rgb(0.95, 0.97, 1),
    borderColor: rgb(0.8, 0.88, 0.98),
    borderWidth: 1,
  });

  const empIdText = `ID: ${employee.employeeId}`;
  const empIdWidth = helveticaBold.widthOfTextAtSize(empIdText, 8.5);
  front.drawText(empIdText, {
    x: (cardWidth - empIdWidth) / 2,
    y: empPillY + 4,
    size: 8.5,
    font: helveticaBold,
    color: rgb(0.04, 0.12, 0.32),
  });

  // Joining Date & Work Location
  const dojText = `Joined: ${employee.dateOfJoining.toLocaleDateString("en-IN", { dateStyle: "medium" })}`;
  const dojWidth = helvetica.widthOfTextAtSize(dojText, 6.5);
  front.drawText(dojText, {
    x: (cardWidth - dojWidth) / 2,
    y: empPillY - 10,
    size: 6.5,
    font: helvetica,
    color: rgb(0.4, 0.45, 0.5),
  });

  // Bottom Footer Bar
  front.drawRectangle({
    x: 0,
    y: 0,
    width: cardWidth,
    height: 18,
    color: rgb(0.04, 0.12, 0.32),
  });

  front.drawText("Rampur, Uttar Pradesh, India", {
    x: 18,
    y: 5.5,
    size: 6,
    font: helvetica,
    color: rgb(0.8, 0.88, 1),
  });

  // ==========================================
  // SIDE 2: BACK OF ID CARD (QR VERIFICATION)
  // ==========================================
  const back = pdfDoc.addPage([cardWidth, cardHeight]);

  // Back Background
  back.drawRectangle({
    x: 0,
    y: 0,
    width: cardWidth,
    height: cardHeight,
    color: rgb(0.98, 0.99, 1),
  });

  // Header Banner
  back.drawRectangle({
    x: 0,
    y: cardHeight - 35,
    width: cardWidth,
    height: 35,
    color: rgb(0.04, 0.12, 0.32),
  });

  back.drawText("ATOMIC PATHSHALA EDUCATION", {
    x: 15,
    y: cardHeight - 18,
    size: 8,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  });

  back.drawText("OFFICIAL VERIFICATION CODE", {
    x: 15,
    y: cardHeight - 28,
    size: 6,
    font: helvetica,
    color: rgb(0.7, 0.82, 0.98),
  });

  // Embedded QR Code (Centered)
  const qrSize = 90;
  const qrX = (cardWidth - qrSize) / 2;
  const qrY = cardHeight - 145;

  if (employee.qrCodeDataUrl) {
    try {
      const qrBase64 = employee.qrCodeDataUrl.replace(/^data:image\/\w+;base64,/, "");
      const qrBuffer = Buffer.from(qrBase64, "base64");
      const qrImg = await pdfDoc.embedPng(qrBuffer);
      back.drawImage(qrImg, {
        x: qrX,
        y: qrY,
        width: qrSize,
        height: qrSize,
      });
    } catch (e) {
      console.warn("[id-card-generator] QR draw notice:", e);
    }
  }

  // Scan Instruction
  back.drawText("SCAN TO VERIFY CREDENTIALS", {
    x: 24,
    y: qrY - 14,
    size: 7.5,
    font: helveticaBold,
    color: rgb(0.04, 0.12, 0.32),
  });

  const baseDomain = getAppBaseDomain();
  const verifyUrlShort = `${baseDomain.replace(/^https?:\/\//, "")}/verify/${employee.employeeId}`;
  back.drawText(verifyUrlShort, {
    x: 15,
    y: qrY - 25,
    size: 6,
    font: helveticaBold,
    color: rgb(0.08, 0.45, 0.8),
  });

  // Terms & Conditions notice
  const termsText = [
    "1. This card is official property of Atomic Pathshala Education.",
    "2. If found, please return to: Rampur, Uttar Pradesh, India.",
    "3. Any unauthorized use or alteration is strictly prohibited.",
  ];
  let termY = qrY - 42;
  for (const t of termsText) {
    back.drawText(t, {
      x: 10,
      y: termY,
      size: 5,
      font: helvetica,
      color: rgb(0.4, 0.45, 0.5),
    });
    termY -= 7.5;
  }

  // Authorized Signatory Box
  back.drawLine({
    start: { x: cardWidth - 85, y: 32 },
    end: { x: cardWidth - 10, y: 32 },
    thickness: 0.8,
    color: rgb(0.04, 0.12, 0.32),
  });

  back.drawText("FIROZ ALI", {
    x: cardWidth - 75,
    y: 22,
    size: 7.5,
    font: timesBold,
    color: rgb(0.04, 0.12, 0.32),
  });

  back.drawText("Founder and Director", {
    x: cardWidth - 80,
    y: 13,
    size: 5.5,
    font: helveticaBold,
    color: rgb(0.3, 0.35, 0.4),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

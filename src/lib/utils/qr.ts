import "server-only";
import QRCode from "qrcode";

/**
 * Generates a QR code as a data: URL. Not persisted to Student.qrCodeUrl yet —
 * that needs the Cloud Object Storage pipeline (see README) to upload a
 * static PNG. For now this renders on-demand, which is correct and scannable,
 * just regenerated per page view instead of cached.
 */
export async function generateStudentQrDataUrl(studentIdCode: string): Promise<string> {
  const payload = `ATOMIC-PATHSHALA-STUDENT:${studentIdCode}`;
  return QRCode.toDataURL(payload, {
    margin: 1,
    width: 200,
    color: { dark: "#0050cb", light: "#ffffff" },
  });
}

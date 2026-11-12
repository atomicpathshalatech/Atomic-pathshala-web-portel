import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") || "ap.atomicpathshala.in";
  const protocol = req.headers.get("x-forwarded-proto") || "https";
  const baseUrl = `${protocol}://${host}`;

  return NextResponse.json({
    success: true,
    data: {
      versionCode: 4,
      versionName: "1.0.3",
      minSupportedVersionCode: 1,
      apkUrl: `${baseUrl}/downloads/AtomicCalling.apk`,
      downloadUrl: `${baseUrl}/downloads/AtomicCalling.apk`,
      releaseNotes: "Critical fix: QR barcode scanner URL scheme normalization, automatic server detection, and real-time SIM sync.",
      publishedAt: new Date().toISOString(),
    },
  });
}

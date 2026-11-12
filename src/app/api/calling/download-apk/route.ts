import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const filePath = path.join(process.cwd(), "public", "downloads", "AtomicCalling.apk");
    if (!fs.existsSync(filePath)) {
      // In serverless environments where local file tracing might not include public dir, redirect to static asset
      return NextResponse.redirect(new URL("/downloads/AtomicCalling.apk", req.url), 302);
    }

    const fileBuffer = fs.readFileSync(filePath);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Disposition": 'attachment; filename="AtomicCalling.apk"',
        "Content-Length": fileBuffer.length.toString(),
        "Cache-Control": "public, max-age=3600, must-revalidate",
      },
    });
  } catch (err: any) {
    return NextResponse.redirect(new URL("/downloads/AtomicCalling.apk", req.url), 302);
  }
}

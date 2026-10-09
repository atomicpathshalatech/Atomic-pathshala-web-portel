import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiError } from "@/lib/api/response";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import path from "node:path";
import fs from "node:fs";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Authentication required", 401);
    }

    await requirePermission(session.user.id, PERMISSIONS.TEAM_PORTAL_ACCESS);

    // The installer (≈150 MB) is not part of the deployment — it lives in file
    // storage. (It used to be read from desktop/teacher/dist, a folder that is
    // git-ignored, so on the live site this download always answered "not found".)
    const { TEACHER_APP_INSTALLER_KEY } = await import("@/lib/desktop/release");
    const base = (process.env.R2_PUBLIC_BASE_URL || process.env.STORAGE_PUBLIC_URL || "").replace(/\/+$/, "");
    if (base) return NextResponse.redirect(`${base}/${TEACHER_APP_INSTALLER_KEY}`, 302);

    // Look for built desktop installer in desktop/teacher/dist
    const distDir = path.join(process.cwd(), "desktop", "teacher", "dist");
    let targetFile: string | null = null;

    if (fs.existsSync(distDir)) {
      const files = fs.readdirSync(distDir);
      const exeFile = files.find((f) => f.endsWith(".exe") && !f.includes("blockmap") && !f.includes("__uninstaller"));
      if (exeFile) {
        targetFile = path.join(distDir, exeFile);
      }
    }

    if (targetFile && fs.existsSync(targetFile)) {
      const stat = fs.statSync(targetFile);
      const fileBuffer = fs.readFileSync(targetFile);
      const fileName = path.basename(targetFile);

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Content-Length": stat.size.toString(),
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    return apiError("Windows Installer binary not found in dist. Please build it first with npm run dist in desktop/teacher.", 404);
  } catch (err: any) {
    console.error("[desktop_download_error]", err);
    return apiError(err.message || "Failed to download desktop app", 500);
  }
}

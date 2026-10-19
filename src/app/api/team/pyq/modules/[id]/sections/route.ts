import { NextRequest } from "next/server";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireTeam } from "@/lib/pyq/api";
import { addSection } from "@/lib/pyq/module-service";

const schema = z.object({ title: z.string().trim().min(1).max(160), instructions: z.string().max(2000).nullable().optional() });

/** POST — add an exercise ("Exercise 2: JEE Main PYQs"). */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireTeam(PERMISSIONS.MODULE_UPDATE);
    const body = schema.parse(await request.json());
    return apiSuccess({ section: await addSection(params.id, body.title, body.instructions) }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

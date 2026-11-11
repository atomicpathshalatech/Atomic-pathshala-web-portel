import { NextRequest } from "next/server";
import { POST as closePost } from "../close/route";

export async function POST(
  request: NextRequest,
  context: { params: { id: string; quizId: string } }
) {
  return closePost(request, context);
}

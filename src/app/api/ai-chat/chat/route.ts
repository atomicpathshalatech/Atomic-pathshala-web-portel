import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { validateChatRequest } from "@/lib/ai-chat/api-validation";
import { ChatApiError, getGeminiErrorDetails } from "@/lib/ai-chat/errors";
import {
  generateChatResponse,
  generateChatResponseStream,
} from "@/lib/ai-chat/gemini";
import { getCurrentUser } from "@/lib/ai-chat/auth";
import {
  hasActiveSubscription,
  getDailyQuestionsUsed,
  recordQuestionUsage,
  DAILY_FREE_LIMIT,
  checkGuestUsage,
  recordGuestUsage,
  GUEST_DAILY_LIMIT,
} from "@/lib/ai-chat/access";

export const runtime = "nodejs";

const GUEST_COOKIE = "guest_id";

function errorResponse(error: unknown) {
  if (error instanceof ChatApiError) {
    if (error.cause) {
      console.error("[Chat API]", getGeminiErrorDetails(error.cause));
    }
    return NextResponse.json({ error: error.message }, { status: error.statusCode });
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Invalid JSON in request body." }, { status: 400 });
  }

  const message =
    error instanceof Error ? error.message : "Something went wrong. Please try again.";

  console.error("[Chat API]", error);
  return NextResponse.json({ error: message }, { status: 500 });
}

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  try {
    // ---- 1. Identify caller: logged-in user or guest ----
    const user = await getCurrentUser();
    let guestId: string | null = null;
    let setGuestCookie = false;

    if (!user) {
      guestId = request.cookies.get(GUEST_COOKIE)?.value ?? null;
      if (!guestId) {
        guestId = randomUUID();
        setGuestCookie = true;
      }
    }

    // ---- 2. Enforce limits BEFORE calling the AI ----
    if (user) {
      const isSubscribed = await hasActiveSubscription(user.id);
      if (!isSubscribed) {
        const used = await getDailyQuestionsUsed(user.id);
        if (used >= DAILY_FREE_LIMIT) {
          return NextResponse.json(
            {
              error: "Aaj ke free 5 sawaal khatam ho gaye. Subscribe karke unlimited sawaal puchein.",
              code: "DAILY_LIMIT_REACHED",
              limit: DAILY_FREE_LIMIT,
            },
            { status: 403 }
          );
        }
      }
    } else {
      const ip = getClientIp(request);
      const { allowed } = await checkGuestUsage(guestId!, ip);
      if (!allowed) {
        const res = NextResponse.json(
          {
            error: "Free 5 sawaal ho gaye. Login karke aur sawaal puchein.",
            code: "LOGIN_REQUIRED",
            limit: GUEST_DAILY_LIMIT,
          },
          { status: 403 }
        );
        if (setGuestCookie) {
          res.cookies.set(GUEST_COOKIE, guestId!, {
            httpOnly: true,
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 365,
          });
        }
        return res;
      }
    }

    // ---- 3. Existing validation + AI call (unchanged) ----
    const body = await request.json();
    const validated = validateChatRequest(body);

    if (validated.stream) {
      const encoder = new TextEncoder();
      const responseStream = generateChatResponseStream(validated, request.signal);
      const firstChunk = await responseStream.next();

      if (firstChunk.done) {
        throw new ChatApiError("Received an empty response from AI.", 500);
      }

      // record usage now that we know the AI actually responded
      if (user) {
        await recordQuestionUsage(user.id);
      } else {
        await recordGuestUsage(guestId!, getClientIp(request));
      }

      const stream = new Response(
        new ReadableStream<Uint8Array>({
          async start(controller) {
            try {
              controller.enqueue(encoder.encode(firstChunk.value));
              for await (const chunk of responseStream) {
                controller.enqueue(encoder.encode(chunk));
              }
              controller.close();
            } catch (error) {
              controller.error(error);
            }
          },
        }),
        {
          headers: {
            "Cache-Control": "no-store, no-transform",
            "Content-Type": "text/plain; charset=utf-8",
            "X-Accel-Buffering": "no",
          },
        }
      );

      if (setGuestCookie) {
        stream.headers.append(
          "Set-Cookie",
          `${GUEST_COOKIE}=${guestId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`
        );
      }
      return stream;
    }

    const message = await generateChatResponse(validated);

    if (user) {
      await recordQuestionUsage(user.id);
    } else {
      await recordGuestUsage(guestId!, getClientIp(request));
    }

    const res = NextResponse.json(
      { message },
      { headers: { "Cache-Control": "no-store" } }
    );
    if (setGuestCookie) {
      res.cookies.set(GUEST_COOKIE, guestId!, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return res;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
